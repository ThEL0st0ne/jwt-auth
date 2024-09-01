import express from "express";
import dotenv from "dotenv";
import connectDB from "./db/index.js"
import {app} from "./app.js"

dotenv.config({
    path: './env'
});

connectDB()
.then(() => {
    app.listen(process.env.PORT || 8000, () => {
        console.log(`Server running at port : ${process.env.PORT}`);
    })
    app.on("Error",() => {
        console.log("Not able to connect to database");
        throw error
    })
})
.catch((error) => {
    console.log("DB connection failed.");
});

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