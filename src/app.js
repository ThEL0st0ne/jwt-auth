import express from "express";
import cors from "cors";
import dotenv from "dotenv"
import cookieParser from "cookie-parser";

dotenv.config();

const app = express()

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,                              //cross origin resource sharing config
}))

app.use(express.json({
    limit: "1000kb"                                 //json file recieving config
}))

app.use(express.urlencoded({        
    extended: true,
    limit: "1000kb",                                //decoding of url                                          
})) 

app.use(express.static("public"))                   //to store files or images in public folder

app.use(cookieParser())

//router import
import userRouter from "../src/routes/user.route.js"

//routes declaration
app.get("/", (req,res) => {
    res.send("yo")
})

app.use("/api/v1/users",userRouter)

//http://localhost:8000/api/v1/users/register

export {app}