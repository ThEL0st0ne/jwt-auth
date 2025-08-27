import { Router } from "express";
import { 
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
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";

const userRouter = Router()

// Authentication routes (4 endpoints)
userRouter.route("/register").post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser
)

userRouter.route("/login").post(loginUser)

userRouter.route("/logout").post(verifyJWT, logoutUser)

userRouter.route("/refresh-token").post(refreshAccessToken)

// Email verification routes (2 endpoints)
userRouter.route("/verify-email/:token").get(verifyEmail)

userRouter.route("/resend-verification").post(resendEmailVerification)

// Password management routes (3 endpoints)
userRouter.route("/change-password").post(verifyJWT, changeCurrentPassword)

userRouter.route("/forgot-password").post(forgotPassword)

userRouter.route("/reset-password").post(resetPassword)

// Profile management routes (6 endpoints)
userRouter.route("/me").get(verifyJWT, getCurrentUser)

userRouter.route("/update-account").patch(verifyJWT, updateAccountDetails)

userRouter.route("/update-avatar").patch(
    verifyJWT, 
    upload.single("avatar"), 
    updateUserAvatar
)

userRouter.route("/update-cover-image").patch(
    verifyJWT, 
    upload.single("coverImage"), 
    updateUserCoverImage
)

userRouter.route("/channel/:username").get(verifyJWT, getUserChannelProfile)

userRouter.route("/watch-history").get(verifyJWT, getWatchHistory)

// User preferences routes (2 endpoints)
userRouter.route("/preferences").get(verifyJWT, getUserPreferences)

userRouter.route("/preferences").patch(verifyJWT, updateUserPreferences)

// User search and discovery routes (3 endpoints)
userRouter.route("/search").get(verifyJWT, searchUsers)

userRouter.route("/search-advanced").get(verifyJWT, searchUsersAdvanced)

userRouter.route("/:userId").get(verifyJWT, getUserById)

// Account management routes (3 endpoints)
userRouter.route("/delete-account").delete(verifyJWT, deleteUserAccount)

userRouter.route("/deactivate-account").post(verifyJWT, deactivateAccount)

userRouter.route("/reactivate-account").post(reactivateAccount)

// User statistics and activity routes (2 endpoints)
userRouter.route("/stats/:userId").get(verifyJWT, getUserStats)

userRouter.route("/activity/:userId").get(verifyJWT, getUserActivity)

// Admin routes (3 endpoints)
userRouter.route("/admin/all-users").get(verifyJWT, getAllUsers)

userRouter.route("/admin/update-status/:userId").patch(verifyJWT, updateUserStatus)

userRouter.route("/admin/bulk-operations").post(verifyJWT, bulkUserOperations)

export default userRouter