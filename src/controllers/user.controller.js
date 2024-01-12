import {asyncHandler} from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiRespose } from "../utils/ApiResponse.js"


const generateAccessAndRefreshToken = async(userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})

        return {accessToken, refreshToken}
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating access and refresh token")
    }
}

const registerUser = asyncHandler(async (req,res) => {
    // get user deatils from frontend
    const {fullname, email, username, password} = req.body

    // validation - notEmpty
    if(
        [fullname, email, username, password].some((field) => field?.trim() === " ")
    ){
        throw new ApiError(400, "All fields are required")
    }

    // check if user already exist: username and email
    const existedUser = await User.findOne({
        $or: [{ email }, { username }]
    })

    if(existedUser){
        throw new ApiError(409, "Username/Email already Exists")
    }

    // check for images, check for avatar
    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar required")
    }

    //upload them to cloudinary
    const avatar = await  uploadOnCloudinary(avatarLocalPath)
    const coverImage = await  uploadOnCloudinary(coverImageLocalPath)
    if(!avatar){
        throw new ApiError("400", "Avatar required")
    }

    // create user objects - create entry in db

    const user = await User.create({
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })
    
    // remove password and refresh token field from response
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken" 
    )

    // check for user creation
    if(!createdUser){
        throw new ApiError(500, "Something while registering the user")
    }

    // return response
    return res.status(201).json(
        new ApiRespose(200, createdUser, "User registered successfuly")
    )

})

const loginUser = asyncHandler(async (req, res) => {
    //req.body se data lana h
    const {email, username, password} = req.body

    if(!username || !email){
        throw new ApiError(400, "Username or password is required")
    }
    //username/email is valid
    const user = await User.findOne({
        $or: [{ username },{ email }]
    })
    //find the user
    if(!user){
        throw new ApiError(404, "User does not exist")
    }
    //password check
    const isPasswordValid = await user.isPasswordCorrect(password)
    if(!isPasswordValid){
        throw new ApiError(401, "Invalid User credentials")
    }
    //access and refresh tokens
    const {accessToken, refreshToken} = await  generateAccessAndRefreshToken(user._id)

    //send cookies
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")
    const options = {
        httpOnly: true,
        secure: true
    }
    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiRespose(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User Logged in successfully"
        )
    )
})

const logoutUser = asyncHandler(async(req,res) => {
    
})

export {
    registerUser,
    loginUser
}

