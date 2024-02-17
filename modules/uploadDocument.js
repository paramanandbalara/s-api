"use strict";

const S3_MODULE = require('../modules/s3');

const uploadDocument = async (params) => {

    try {

        let {file_name, file_type, key} = params;

        let image_type = ['pdf', 'png', 'jpeg', 'jpg'];

        if (!image_type.includes(file_type)) {

            throw new Error('please upload file type')
        }

        if (!file_name) {

            throw new Error('Please upload file');
        }

        let content_type = `image/${file_type}`;

        if (file_type.toLowerCase() == 'pdf') {

            content_type = 'application/pdf';
        }

        const S3 = new S3_MODULE();

        file_name = file_name.split(',').length > 1 ? file_name.split(',')[1] : file_name;

        await S3.s3Upload(key, Buffer.from(file_name, 'base64'), content_type);

        return true
    }
    catch (err) {
        console.error("Image upload error", err)
    }
}

module.exports = {uploadDocument}
