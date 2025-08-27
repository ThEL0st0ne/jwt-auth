import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config()

const userSchema = new Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        fullName: {
            type: String,
            required: true,
            trim: true,
            index: true
        },
        avatar: {
            type: String,  //cloudinary url
            required: true,
        },
        coverImage: {
            type: String,  //cloudinary url
        },
        watchHistroy:[
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Video"
            }
        ],
        password: {
            type: String,
            required: [true, 'Password is required']
        },
        refreshToken: {
            type: String
        },
        // New fields for enhanced functionality
        isEmailVerified: {
            type: Boolean,
            default: false
        },
        isActive: {
            type: Boolean,
            default: true
        },
        role: {
            type: String,
            enum: ['user', 'admin', 'moderator'],
            default: 'user'
        },
        loginCount: {
            type: Number,
            default: 0
        },
        lastLoginAt: {
            type: Date
        },
        deactivationReason: {
            type: String
        },
        deactivatedAt: {
            type: Date
        },
        preferences: {
            theme: {
                type: String,
                enum: ['light', 'dark', 'auto'],
                default: 'light'
            },
            language: {
                type: String,
                default: 'en'
            },
            notifications: {
                email: {
                    type: Boolean,
                    default: true
                },
                push: {
                    type: Boolean,
                    default: true
                },
                marketing: {
                    type: Boolean,
                    default: false
                }
            },
            privacy: {
                profileVisibility: {
                    type: String,
                    enum: ['public', 'private', 'friends'],
                    default: 'public'
                },
                showEmail: {
                    type: Boolean,
                    default: false
                },
                showLastSeen: {
                    type: Boolean,
                    default: true
                }
            },
            timezone: {
                type: String,
                default: 'UTC'
            }
        },
        // Social media links
        socialLinks: {
            twitter: String,
            instagram: String,
            youtube: String,
            linkedin: String,
            website: String
        },
        // User bio and additional info
        bio: {
            type: String,
            maxlength: 500
        },
        location: String,
        dateOfBirth: Date,
        // Account security
        twoFactorEnabled: {
            type: Boolean,
            default: false
        },
        twoFactorSecret: String,
        // Account recovery
        recoveryEmail: String,
        securityQuestions: [{
            question: String,
            answer: String
        }],
        // Activity tracking
        lastActivityAt: {
            type: Date,
            default: Date.now
        },
        // Account statistics
        totalVideos: {
            type: Number,
            default: 0
        },
        totalSubscribers: {
            type: Number,
            default: 0
        },
        totalViews: {
            type: Number,
            default: 0
        }
    },{timestamps: true}
);

userSchema.pre("save", async function (next) {        // "next" since middleware
    if (!this.isModified("password")) return next()
    this.password = await bcrypt.hash(this.password, 10)     //10 means hasing for 10 rounds (check docs)
    next()
})

userSchema.methods.isPasswordCorrect = async function (password){
    return await bcrypt.compare(password, this.password)  //This type of user written methods are accesed by the returned user instance that you take from db          
}

userSchema.methods.generateAccessToken = function(){
    return  jwt.sign(
            {
                _id: this._id,
                email: this.email,
                username: this.username,
                role: this.role
            },
            process.env.ACCESS_TOKEN_SECRET,
            {
                expiresIn: process.env.ACCESS_TOKEN_EXPIRY
            }
        )
}
userSchema.methods.generateRefreshToken = function(){
    return  jwt.sign(
        {
            _id: this._id
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}

userSchema.methods.generatePasswordResetToken = function(){
    return jwt.sign(
        {
            _id: this._id,
            email: this.email
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: "15m" // 15 minutes
        }
    )
}

userSchema.methods.generateEmailVerificationToken = function(){
    return jwt.sign(
        {
            _id: this._id,
            email: this.email
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: "24h" // 24 hours
        }
    )
}

// Method to update login statistics
userSchema.methods.updateLoginStats = function(){
    this.loginCount += 1
    this.lastLoginAt = new Date()
    this.lastActivityAt = new Date()
    return this.save({ validateBeforeSave: false })
}

// Method to check if user can perform actions
userSchema.methods.canPerformAction = function(){
    return this.isActive && this.isEmailVerified
}

// Method to get user display name
userSchema.methods.getDisplayName = function(){
    return this.fullName || this.username
}

// Method to check if user is admin
userSchema.methods.isAdmin = function(){
    return this.role === 'admin'
}

// Method to check if user is moderator or admin
userSchema.methods.isModerator = function(){
    return this.role === 'moderator' || this.role === 'admin'
}

// Virtual for user age
userSchema.virtual('age').get(function() {
    if (!this.dateOfBirth) return null
    const today = new Date()
    const birthDate = new Date(this.dateOfBirth)
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--
    }
    
    return age
})

// Virtual for account age
userSchema.virtual('accountAge').get(function() {
    const today = new Date()
    const created = new Date(this.createdAt)
    const diffTime = Math.abs(today - created)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
})

// Indexes for better query performance
userSchema.index({ email: 1, isActive: 1 })
userSchema.index({ username: 1, isActive: 1 })
userSchema.index({ createdAt: -1 })
userSchema.index({ lastActivityAt: -1 })
userSchema.index({ role: 1, isActive: 1 })

export const User = mongoose.model('User',userSchema);