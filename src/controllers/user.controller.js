import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiErrors} from "../utils/ApiErros.js"
import {User} from "../models/users.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"

const generateAccessAndRefreshToken = async(userId) => {
    try {
        const user =await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return {accessToken, refreshToken}

    } catch (error) {
        throw new ApiErrors(500, "Something went wrong with tokens")
    }
}

const registerUser = asyncHandler( async(req,res) => {
     // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res

    const {fullName, email, username, password } = req.body

    if ([fullName, email, username, password ].some((fields) => {fields?.trim() === ""})){
        throw new ApiErrors(400,"All files are required")
    }

    const existedUser = await User.findOne({
        $or: [{username}, {email}]
    })

    if (existedUser){
        throw new ApiErrors(409, "User with same Email or Username already exists")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path

    if (!avatarLocalPath) {
        throw new ApiErrors(400, "Avatar file is required")
    }
    
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiErrors(400, "Avatar file is required")
    }
   

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email, 
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) {
        throw new ApiErrors(500, "Something went wrong while registering the user")
    }
    

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    )
    
})

const loginUser = asyncHandler( async(req,res) => {
    // req body -> data
    // username or email
    //find the user
    //password check
    //access and referesh token
    //send cookie

    const {email, password, username} = req.body
    

    if (!username || !email) {
        throw new ApiErrors(400, "Username or Password is required.")
    }

    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if (!user) {
        throw new ApiErrors(404, "User doesn't exist.")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)
    
    if (!isPasswordValid){
        throw new ApiErrors(401, "Invalid password")
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)

    // Update login statistics
    await user.updateLoginStats()

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,      //cookies options designing
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200, 
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged In Successfully"
        )
    )

})

const logoutUser = asyncHandler(async (req,res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1 // this removes the field from document
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiErrors(401, "unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new ApiErrors(401, "Invalid refresh token")
        }
    
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiErrors(401, "Refresh token is expired or used")
            
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newRefreshToken} = await generateAccessAndRefreshToken(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200, 
                {accessToken, refreshToken: newRefreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiErrors(401, error?.message || "Invalid refresh token")
    }

})

// Get current user profile
const getCurrentUser = asyncHandler(async (req, res) => {
    return res.status(200).json(
        new ApiResponse(200, req.user, "Current user fetched successfully")
    )
})

// Update account details
const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body

    if (!fullName || !email) {
        throw new ApiErrors(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email
            }
        },
        { new: true }
    ).select("-password")

    return res.status(200).json(
        new ApiResponse(200, user, "Account details updated successfully")
    )
})

// Update user avatar
const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new ApiErrors(400, "Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if (!avatar.url) {
        throw new ApiErrors(400, "Error while uploading avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        { new: true }
    ).select("-password")

    return res.status(200).json(
        new ApiResponse(200, user, "Avatar updated successfully")
    )
})

// Update user cover image
const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new ApiErrors(400, "Cover image file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!coverImage.url) {
        throw new ApiErrors(400, "Error while uploading cover image")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        { new: true }
    ).select("-password")

    return res.status(200).json(
        new ApiResponse(200, user, "Cover image updated successfully")
    )
})

// Change current password
const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body

    if (!oldPassword || !newPassword) {
        throw new ApiErrors(400, "Old password and new password are required")
    }

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect) {
        throw new ApiErrors(400, "Invalid old password")
    }

    user.password = newPassword
    await user.save({ validateBeforeSave: false })

    return res.status(200).json(
        new ApiResponse(200, {}, "Password changed successfully")
    )
})

// Get user channel profile
const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params

    if (!username?.trim()) {
        throw new ApiErrors(400, "Username is missing")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ])

    if (!channel?.length) {
        throw new ApiErrors(404, "Channel does not exist")
    }

    return res.status(200).json(
        new ApiResponse(200, channel[0], "User channel fetched successfully")
    )
})

// Get watch history
const getWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistroy",
                foreignField: "_id",
                as: "watchHistroy",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res.status(200).json(
        new ApiResponse(
            200,
            user[0].watchHistroy,
            "Watch history fetched successfully"
        )
    )
})

// Search users
const searchUsers = asyncHandler(async (req, res) => {
    const { query } = req.query

    if (!query) {
        throw new ApiErrors(400, "Search query is required")
    }

    const users = await User.find({
        $or: [
            { username: { $regex: query, $options: 'i' } },
            { fullName: { $regex: query, $options: 'i' } }
        ]
    }).select("-password -refreshToken")

    return res.status(200).json(
        new ApiResponse(200, users, "Users found successfully")
    )
})

// Get user by ID
const getUserById = asyncHandler(async (req, res) => {
    const { userId } = req.params

    if (!userId) {
        throw new ApiErrors(400, "User ID is required")
    }

    const user = await User.findById(userId).select("-password -refreshToken")

    if (!user) {
        throw new ApiErrors(404, "User not found")
    }

    return res.status(200).json(
        new ApiResponse(200, user, "User fetched successfully")
    )
})

// Delete user account
const deleteUserAccount = asyncHandler(async (req, res) => {
    const { password } = req.body

    if (!password) {
        throw new ApiErrors(400, "Password is required to delete account")
    }

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(password)

    if (!isPasswordCorrect) {
        throw new ApiErrors(400, "Invalid password")
    }

    await User.findByIdAndDelete(req.user?._id)

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "Account deleted successfully"))
})

// Forgot password
const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body

    if (!email) {
        throw new ApiErrors(400, "Email is required")
    }

    const user = await User.findOne({ email })

    if (!user) {
        throw new ApiErrors(404, "User not found with this email")
    }

    // Generate reset token
    const resetToken = user.generatePasswordResetToken()
    await user.save({ validateBeforeSave: false })

    // Here you would typically send an email with the reset token
    // For now, we'll just return a success message
    return res.status(200).json(
        new ApiResponse(200, {}, "Password reset instructions sent to your email")
    )
})

// Get all users (admin only)
const getAllUsers = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, sortBy = "createdAt", sortOrder = "desc" } = req.query

    const skip = (page - 1) * limit
    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 }

    const users = await User.find()
        .select("-password -refreshToken")
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))

    const totalUsers = await User.countDocuments()

    return res.status(200).json(
        new ApiResponse(200, {
            users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalUsers,
                pages: Math.ceil(totalUsers / limit)
            }
        }, "Users fetched successfully")
    )
})

// Enhanced password reset with proper token verification
const resetPassword = asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body

    if (!token || !newPassword) {
        throw new ApiErrors(400, "Token and new password are required")
    }

    try {
        // Verify the reset token
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
        
        const user = await User.findById(decodedToken._id)
        
        if (!user) {
            throw new ApiErrors(400, "Invalid reset token")
        }

        // Update password
        user.password = newPassword
        await user.save({ validateBeforeSave: false })

        return res.status(200).json(
            new ApiResponse(200, {}, "Password reset successfully")
        )
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            throw new ApiErrors(400, "Invalid or expired reset token")
        }
        throw new ApiErrors(500, "Error resetting password")
    }
})

// Email verification
const verifyEmail = asyncHandler(async (req, res) => {
    const { token } = req.params

    if (!token) {
        throw new ApiErrors(400, "Verification token is required")
    }

    try {
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
        
        const user = await User.findById(decodedToken._id)
        
        if (!user) {
            throw new ApiErrors(400, "Invalid verification token")
        }

        if (user.isEmailVerified) {
            return res.status(200).json(
                new ApiResponse(200, {}, "Email already verified")
            )
        }

        user.isEmailVerified = true
        await user.save({ validateBeforeSave: false })

        return res.status(200).json(
            new ApiResponse(200, {}, "Email verified successfully")
        )
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            throw new ApiErrors(400, "Invalid or expired verification token")
        }
        throw new ApiErrors(500, "Error verifying email")
    }
})

// Resend email verification
const resendEmailVerification = asyncHandler(async (req, res) => {
    const { email } = req.body

    if (!email) {
        throw new ApiErrors(400, "Email is required")
    }

    const user = await User.findOne({ email })

    if (!user) {
        throw new ApiErrors(404, "User not found")
    }

    if (user.isEmailVerified) {
        return res.status(200).json(
            new ApiResponse(200, {}, "Email already verified")
        )
    }

    // Generate verification token
    const verificationToken = user.generateEmailVerificationToken()
    await user.save({ validateBeforeSave: false })

    // Here you would send verification email
    return res.status(200).json(
        new ApiResponse(200, {}, "Verification email sent successfully")
    )
})

// Update user preferences
const updateUserPreferences = asyncHandler(async (req, res) => {
    const { 
        theme, 
        language, 
        notifications, 
        privacy, 
        timezone 
    } = req.body

    const updateData = {}
    
    if (theme) updateData['preferences.theme'] = theme
    if (language) updateData['preferences.language'] = language
    if (notifications) updateData['preferences.notifications'] = notifications
    if (privacy) updateData['preferences.privacy'] = privacy
    if (timezone) updateData['preferences.timezone'] = timezone

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        { $set: updateData },
        { new: true }
    ).select("-password -refreshToken")

    return res.status(200).json(
        new ApiResponse(200, user, "Preferences updated successfully")
    )
})

// Get user preferences
const getUserPreferences = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user?._id)
        .select("preferences")

    return res.status(200).json(
        new ApiResponse(200, user.preferences, "Preferences fetched successfully")
    )
})

// Deactivate account
const deactivateAccount = asyncHandler(async (req, res) => {
    const { password, reason } = req.body

    if (!password) {
        throw new ApiErrors(400, "Password is required to deactivate account")
    }

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(password)

    if (!isPasswordCorrect) {
        throw new ApiErrors(400, "Invalid password")
    }

    user.isActive = false
    user.deactivationReason = reason || "User requested deactivation"
    user.deactivatedAt = new Date()
    await user.save({ validateBeforeSave: false })

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "Account deactivated successfully"))
})

// Reactivate account
const reactivateAccount = asyncHandler(async (req, res) => {
    const { email, password } = req.body

    if (!email || !password) {
        throw new ApiErrors(400, "Email and password are required")
    }

    const user = await User.findOne({ email })

    if (!user) {
        throw new ApiErrors(404, "User not found")
    }

    if (user.isActive) {
        return res.status(200).json(
            new ApiResponse(200, {}, "Account is already active")
        )
    }

    const isPasswordCorrect = await user.isPasswordCorrect(password)

    if (!isPasswordCorrect) {
        throw new ApiErrors(400, "Invalid password")
    }

    user.isActive = true
    user.deactivationReason = undefined
    user.deactivatedAt = undefined
    await user.save({ validateBeforeSave: false })

    return res.status(200).json(
        new ApiResponse(200, {}, "Account reactivated successfully")
    )
})

// Enhanced user search with filters
const searchUsersAdvanced = asyncHandler(async (req, res) => {
    const { 
        query, 
        page = 1, 
        limit = 10, 
        sortBy = "createdAt", 
        sortOrder = "desc",
        isActive,
        isEmailVerified,
        dateFrom,
        dateTo
    } = req.query

    const skip = (page - 1) * limit
    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 }

    // Build search criteria
    const searchCriteria = {}

    if (query) {
        searchCriteria.$or = [
            { username: { $regex: query, $options: 'i' } },
            { fullName: { $regex: query, $options: 'i' } },
            { email: { $regex: query, $options: 'i' } }
        ]
    }

    if (isActive !== undefined) {
        searchCriteria.isActive = isActive === 'true'
    }

    if (isEmailVerified !== undefined) {
        searchCriteria.isEmailVerified = isEmailVerified === 'true'
    }

    if (dateFrom || dateTo) {
        searchCriteria.createdAt = {}
        if (dateFrom) searchCriteria.createdAt.$gte = new Date(dateFrom)
        if (dateTo) searchCriteria.createdAt.$lte = new Date(dateTo)
    }

    const users = await User.find(searchCriteria)
        .select("-password -refreshToken")
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))

    const totalUsers = await User.countDocuments(searchCriteria)

    return res.status(200).json(
        new ApiResponse(200, {
            users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalUsers,
                pages: Math.ceil(totalUsers / limit)
            }
        }, "Users found successfully")
    )
})

// Get user statistics
const getUserStats = asyncHandler(async (req, res) => {
    const { userId } = req.params

    if (!userId) {
        throw new ApiErrors(400, "User ID is required")
    }

    const stats = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "_id",
                foreignField: "owner",
                as: "videos"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                totalVideos: { $size: "$videos" },
                totalSubscribers: { $size: "$subscribers" },
                totalSubscriptions: { $size: "$subscribedTo" },
                totalWatchHistory: { $size: "$watchHistroy" }
            }
        },
        {
            $project: {
                totalVideos: 1,
                totalSubscribers: 1,
                totalSubscriptions: 1,
                totalWatchHistory: 1,
                createdAt: 1,
                lastLoginAt: 1
            }
        }
    ])

    if (!stats.length) {
        throw new ApiErrors(404, "User not found")
    }

    return res.status(200).json(
        new ApiResponse(200, stats[0], "User statistics fetched successfully")
    )
})

// Update user status (admin only)
const updateUserStatus = asyncHandler(async (req, res) => {
    const { userId } = req.params
    const { isActive, isEmailVerified, role } = req.body

    if (!userId) {
        throw new ApiErrors(400, "User ID is required")
    }

    const updateData = {}
    if (isActive !== undefined) updateData.isActive = isActive
    if (isEmailVerified !== undefined) updateData.isEmailVerified = isEmailVerified
    if (role) updateData.role = role

    const user = await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true }
    ).select("-password -refreshToken")

    if (!user) {
        throw new ApiErrors(404, "User not found")
    }

    return res.status(200).json(
        new ApiResponse(200, user, "User status updated successfully")
    )
})

// Get user activity log
const getUserActivity = asyncHandler(async (req, res) => {
    const { userId } = req.params
    const { page = 1, limit = 20 } = req.query

    if (!userId) {
        throw new ApiErrors(400, "User ID is required")
    }

    const skip = (page - 1) * limit

    // This would typically query an activity log collection
    // For now, we'll return basic user activity data
    const user = await User.findById(userId)
        .select("createdAt lastLoginAt loginCount")

    if (!user) {
        throw new ApiErrors(404, "User not found")
    }

    const activity = {
        accountCreated: user.createdAt,
        lastLogin: user.lastLoginAt,
        totalLogins: user.loginCount || 0
    }

    return res.status(200).json(
        new ApiResponse(200, {
            activity,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit)
            }
        }, "User activity fetched successfully")
    )
})

// Bulk user operations (admin only)
const bulkUserOperations = asyncHandler(async (req, res) => {
    const { operation, userIds, data } = req.body

    if (!operation || !userIds || !Array.isArray(userIds)) {
        throw new ApiErrors(400, "Operation, userIds array, and data are required")
    }

    let result

    switch (operation) {
        case 'activate':
            result = await User.updateMany(
                { _id: { $in: userIds } },
                { $set: { isActive: true } }
            )
            break
        case 'deactivate':
            result = await User.updateMany(
                { _id: { $in: userIds } },
                { $set: { isActive: false } }
            )
            break
        case 'delete':
            result = await User.deleteMany({ _id: { $in: userIds } })
            break
        case 'update':
            result = await User.updateMany(
                { _id: { $in: userIds } },
                { $set: data }
            )
            break
        default:
            throw new ApiErrors(400, "Invalid operation")
    }

    return res.status(200).json(
        new ApiResponse(200, {
            modifiedCount: result.modifiedCount || result.deletedCount,
            operation
        }, "Bulk operation completed successfully")
    )
})

export {
    registerUser, 
    loginUser, 
    logoutUser, 
    refreshAccessToken,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    changeCurrentPassword,
    getUserChannelProfile,
    getWatchHistory,
    searchUsers,
    getUserById,
    deleteUserAccount,
    forgotPassword,
    resetPassword,
    getAllUsers,
    verifyEmail,
    resendEmailVerification,
    updateUserPreferences,
    getUserPreferences,
    deactivateAccount,
    reactivateAccount,
    searchUsersAdvanced,
    getUserStats,
    updateUserStatus,
    getUserActivity,
    bulkUserOperations
}