'use strict';

const jwt = require('jsonwebtoken');
const { getUser } = require('./../models/users');
const { getRefreshToken, saveAccessToken } = require('./../models/authToken');
const Auth = require('../../shyptrack-static/auth.json');

// A reusable function to send an unauthorized response with a specific message
const sendUnauthorizedResponse = (res, message) => {
  res.status(401).send({ success: false, message, logout: true });
};

// The authentication middleware function
const auth = async (req, res, next) => {
  try {
    const token = req.header('access_token');
    const userId = Number(req.header('x-userid'));
    // Check if the user ID exists in the request headers
    if (!userId) {
      return sendUnauthorizedResponse(res, 'Unauthorised! please login again');
    }

    // Check if the access token exists in the request headers
    if (!token) {
      return sendUnauthorizedResponse(res, 'Access token not valid');
    }

    try {
      // Verify the access token
      const accessToken = jwt.verify(token, process.env.AUTH_SECRET_KEY);

      // Get the refresh token from the database
      const { rid: refreshTokenId, user_id: tokenUserId } = accessToken;

      // Check if the user ID in the access token matches the one in the request headers
      if (userId !== tokenUserId) {
        return sendUnauthorizedResponse(res, 'User id mismatched');
      }
      const [refreshTokenFromDb] = await getRefreshToken(refreshTokenId);

      // Check if the refresh token exists in the database
      if (!refreshTokenFromDb) {
        return sendUnauthorizedResponse(
          res,
          'Invalid token, please login again',
        );
      }
        
      const { session_status: sessionStatus } = refreshTokenFromDb;
      
      //0 - Default, 1 - Refresh, 2- logout
      if (sessionStatus !== 0) {
        return sendUnauthorizedResponse(
          res,
          'Invalid token, please login again',
        );
      }

      // If everything is OK, call the next middleware function
      return next();
    } catch (err) {
      const errorMessage = err.message;
      // Check if the access token has expired
      if (errorMessage.includes('jwt expired')) {
        try {
          // Decode the access token to get the refresh token ID
          const decodedToken = jwt.decode(token);
          const { rid: refreshTokenId, source: decodedSource } = decodedToken;
          // Get the refresh token from the database
          const [refreshTokenFromDb] = await getRefreshToken(refreshTokenId);

          // Check if the refresh token exists in the database
          if (!refreshTokenFromDb) {
            return sendUnauthorizedResponse(
              res,
              'Invalid token, please login again',
            );
          }

          const { refresh_token, session_status: sessionStatus } =
            refreshTokenFromDb;

          //0 - Default, 1 - Refresh, 2- logout
          if (sessionStatus !== 0) {
            return sendUnauthorizedResponse(
              res,
              'Invalid token, please login again',
            );
          }
          const refreshToken = jwt.decode(
            refresh_token,
            process.env.AUTH_REFRESH_SECRECT_KEY,
          );
          const {
            exp: refreshTokenExp,
            source,
            user_id,
            user_name,
            hub_id = null,
            role,
          } = refreshToken;
          // Check if the refresh token has expired
          if (+new Date() / 1000 - refreshTokenExp > 0) {
            return sendUnauthorizedResponse(
              res,
              'Session Expired! Please login again',
            );
          }

          // Check if the source of the refresh token matches the one in the access token
          if (source !== decodedSource) {
            return sendUnauthorizedResponse(
              res,
              'Unauthorised! please login again',
            );
          }

          // Check if the user ID in the refresh token matches the one in the request headers
          if (userId !== user_id) {
            return sendUnauthorizedResponse(
              res,
              'Unauthorised! please login again',
            );
          }

          // Create a new payload for the new access token
          const payload = {
            source,
            user_id,
            hub_id,
            user_name,
            role,
            rid: refreshTokenId,
          };

          // Generate a new access token
          const accessToken = jwt.sign(payload, process.env.AUTH_SECRET_KEY, {
            expiresIn: Auth.AUTH_TOKEN_EXPIRE_TIME,
          });

          // Save the new access token to the database
          await saveAccessToken(refreshTokenId, accessToken);

          // Set the new access token in the response headers
          res.append('access_token', accessToken);
          // Call the next middleware function
          return next();
        } catch (err) {
          console.error('jwt', 'verify user detail', err);
          return sendUnauthorizedResponse(
            res,
            'Unauthorised ! Please login again',
          );
        }
      }
    }
  } catch (err) {
    console.error(err);
    next(err.message);
  }
};

module.exports = { auth };
