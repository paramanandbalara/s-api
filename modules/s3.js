"use strict";

const AWS = require('aws-sdk');
const fs = require('fs');

const {
    ACCESS_KEY_ID,
    SECRET_ACCESS_KEY,
    SIGN_VER, REGION,
    BUCKET_NAME
} = require("../../shyptrack-static/s3.json");

const s3 = new AWS.S3({

    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
    signatureVersion: SIGN_VER,
    region: REGION
});

class S3 {

    async s3Upload(filename, content, contentType) {
        try {

            const params = {

                Bucket: BUCKET_NAME,
                Key: filename,
                Body: content
            };

            if (contentType) {
                params.ContentType = contentType
            };

            return s3
            .upload(params)
            .promise()
            .then( () => 'Done uploading')
            .catch(error => {
                return Promise.reject(error);
            })

        } catch (err) {
            return Promise.reject(err)
        }
    }

    async getAllFiles (filePath, finalResult = [], StartAfter = false) {

        return new Promise((resolve, reject) => {
    
            let obj = {
                Bucket: BUCKET_NAME,
                Prefix: filePath
                // StartAfter: 'DLimages/1234710419005.jpg'
            }
    
            if (StartAfter) {
                obj.StartAfter = StartAfter;
            }
    
            s3.listObjectsV2(obj, async (err, result) => {
    
                if (err)
                    return reject(err)
    
                finalResult = [...finalResult, ...result.Contents];
                let contentLength = result.Contents.length;
                if (result.KeyCount < 1000) {
                    return resolve(finalResult);
                }
                let recursive = await getAllFiles(filePath, finalResult, result.Contents[contentLength-1].Key);
            })
        })
    }

    async getFilePath(filePath, minutes = 5) {

        const signedUrlExpireSeconds = 60 * minutes;
    
        return new Promise((resolve, reject) => {
    
            s3.getSignedUrl('getObject', {
                Bucket: BUCKET_NAME,
                Key: filePath,
                Expires: signedUrlExpireSeconds
            }, (err, result) => {
    
                if (err)
                    return reject(err)
    
                resolve(result)
            })
        })
    }

    async uploadToS3 (bucket=BUCKET_NAME, s3Path="", localFilePath="", option)  {

        if (!localFilePath || !localFilePath.trim().length) {
            return Promise.reject(new Error("Invalid local file destination path"));
        }
    
        if (!s3Path || !s3Path.trim().length) {
            return Promise.reject(new Error("Invalid S3 destination path"));
        }

        const body = fs.createReadStream(localFilePath);
    
        const s3Params = {
            Bucket: BUCKET_NAME,
            Key: s3Path,
            Body: body
        };
    
        if (option && option.contentType && option.contentType.length) {
            s3Params.ContentType = option.contentType;
        }
    
        return s3
        .upload(s3Params)
        .promise()
        .then( () => 'Done uploading')
        .catch(error => {
            return Promise.reject(error);
        })
    
    }

    async getFilePath(key, minutes = 5) {
        try {

            const signedUrlExpireSeconds = 60 * minutes;

            return new Promise((resolve, reject) => {
                s3.getSignedUrl('getObject', {
                    Bucket: BUCKET_NAME,
                    Key: key,
                    Expires: signedUrlExpireSeconds
                }, (err, result) => {
                    if (err)
                        return reject(err)
                    return resolve(result)
                })
            })
        }
        catch (err) {
            return Promise.reject(err)
        }
    }
    
    async findObject(key) {
        try {

            const params = {
                Bucket: BUCKET_NAME,
                MaxKeys: 1,
                Prefix: key
            }
            return new Promise((resolve, reject) => {
                s3.listObjectsV2(params, function (err, data) {
                    if (err) return reject(err);
                    if (data.Contents.length > 0)
                        return resolve(data.Contents[0].Key)
                    else
                        return reject(`Cannot find key: ${key}`)
                })
            })
        }
        catch (err) {
            console.log(__line,err)
            return Promise.reject(err)
        }
    }

    async checkFileExistence(filePath) {

        const myBucket = BUCKET_NAME
        //const signedUrlExpireSeconds = 60 * minutes;
        AWS.config.update(
            {
                accessKeyId: ACCESS_KEY_ID,
                secretAccessKey: SECRET_ACCESS_KEY,
                signatureVersion: SIGN_VER,
                region: REGION
            });

        const s3 = new AWS.S3();
        return new Promise((resolve, reject) => {
            s3.headObject({
                Bucket: myBucket,
                Key: filePath
            }, function (err, metadata) {
                if (err && err.code === 'NotFound') {
                    //console.log(__line,"err")
                    return resolve(undefined)
                } else {
                    //console.log(__line,"file found");
                    return resolve(true)
                }
            });
        })
    }

}

module.exports = S3;
