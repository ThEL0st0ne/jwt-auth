//async funtion wrapper using promises

const asyncHandler = (requestHandler) => {
    return (req,res,next) => {
        Promise.resolve(requestHandler(req,res,next)).catch((error) => { next(error) })
    }
}


export {asyncHandler}

/*

async funtion wrapper using  try-catch block

const asyncHandler = (fn) => async (req,res,next) => {
    try {
        await fn(req,res,next)
    } catch (error) {
        res.status(error.code).json({
            success: false,
            message: error.message
        })
    }
}
*/