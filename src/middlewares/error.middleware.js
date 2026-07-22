export const errorHandler = (error, req, res, next) => {
  console.log(error.response?.data);

  return res.status(error.response?.status || 500).json({
    success: false,
    message: error.message,
    details: error.response?.data,
  });
};

