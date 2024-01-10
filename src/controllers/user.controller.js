import {asyncHandler} from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiRespose } from "../utils/ApiResponse.js"


const registerUser = asyncHandler(async (req,res) => {
    // get user deatils from frontend
    const {fullName, email, username, password} = req.body
    console.log("Email: ", email)

    // validation - notEmpty
    if(
        [fullName, email, username, password].some((field) => field?.trim() === " ")
    ){
        throw new ApiError(400, "All fields are required")
    }

    // check if user already exist: username and email
    const existedUser = User.findOne({
        $or: [{ email }, { username }]
    })

    if(existedUser){
        throw new ApiError(409, "Username/Email already Exists")
    }

    // check for images, check for avatar
    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path

    if(!avatarLocalPath){
        throw new ApiError("400", "Avatar required")
    }

    //upload them to cloudinary
    const avatar = await  uploadOnCloudinary(avatarLocalPath)
    const coverImage = await  uploadOnCloudinary(coverImageLocalPath)
    if(!avatar){
        throw new ApiError("400", "Avatar required")
    }

    // create user objects - create entry in db

    const user = await User.create({
        fullName,
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

export {registerUser}

