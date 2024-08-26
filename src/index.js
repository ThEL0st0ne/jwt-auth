import express from "express";
import dotenv from "dotenv";
import connectDB from "./db/index.js"



dotenv.config({
    path: './env'
});

connectDB();

/*
const app = express();

( async () => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("Error",() => {
            console.log("Not able to connect to database");
            throw error
        })

        app.listen(process.env.PORT, () => {
            console.log(`App is active on port ${process.env.PORT}`);
            
        })

    } catch (error) {
        console.error("Error",error);
        throw error
    }
} )()

*/