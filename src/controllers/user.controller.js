import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiErrors} from "../utils/ApiErros.js"
import {User} from "../models/users.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { response } from "express"

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

export {registerUser}