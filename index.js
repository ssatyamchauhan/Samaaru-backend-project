const express = require('express');
const app = express()
const PORT = 3000 || env.process.PORT
const _ = require('underscore')
const fs = require('fs')
const chokidar = require('chokidar');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const NodeGoogleDrive = require('node-google-drive')

const path = require('path')
const YOUR_ROOT_FOLDER = '1fGfOpYjjQJnH1sjBfSCyZQGTXMWykRz-',
    PATH_TO_CREDENTIALS = path.resolve(`./samaaru-268608-9a3900aa3eae.json`);

// Let's wrap everything in an async function to use await sugar
async function Samaaru() {
    // importing the credentials json data 
    const creds_service_user = require(PATH_TO_CREDENTIALS);

    // creating google drive instance
    const googleDriveInstance = new NodeGoogleDrive({
        ROOT_FOLDER: YOUR_ROOT_FOLDER
    });
    let gdrive = await googleDriveInstance.useServiceAccountAuth(
        creds_service_user
    );

    // creating Google Sheet Object 
    const doc = new GoogleSpreadsheet('1iJmcL3NA2e5-eil8JFHtO8vJ8Uqh95zAJKoRQ-pgAew');
    await doc.useServiceAccountAuth(creds_service_user);
    await doc.loadInfo();


    // listing files of a drive public folder
    let listFilesResponse = await googleDriveInstance.listFiles(
        YOUR_ROOT_FOLDER,
        null,
        false
    )
    const README = _.where(listFilesResponse.files, { name: 'README.md' })
    const CHANGE = _.where(listFilesResponse.files, { name: 'CHANGELOG.md' })

    // This function creates file on drive on the given root direcotory
    async function createFile() {
        let writeFileReadme = await googleDriveInstance.writeFile(
            'README.md',
            YOUR_ROOT_FOLDER,
            'README.md',
            'text/markdown'
        )
        let writeFileChangeLog = await googleDriveInstance.writeFile(
            'CHANGELOG.md',
            YOUR_ROOT_FOLDER,
            'CHANGELOG.md',
            'text/markdown'
        )
        console.log(writeFileReadme, writeFileChangeLog)
    }

    // function updateFile is to update file on drive if there is any changes in README.md and CHANGELOG.md file
    function updateFile(fileName, fileId, mimeType, data) {
        var fileMetadata = {
            'name': fileName
        };

        var media = {
            mimeType: mimeType,
            body: data
        };

        gdrive.files.update({
            fileId: fileId,
            resource: fileMetadata,
            media: media
        }, (err, file) => {
            if (err) {
                // Handle error
                console.error(err);
            } else {
                console.log('File Id: ', file.id);
            }
        });
    }

    // function updateSheet is to update file on drive if there is any changes in package.json file
    async function updateSheet(data) {

        // accessing sheet package at index 0 in worksheet.
        const sheet = doc.sheetsByIndex[0];
        const sheetid = sheet._rawProperties.sheetId;
        await doc._makeBatchUpdateRequest(
            [
                {
                    "deleteRange": {
                        "range": {
                            "sheetId": sheetid,
                            "startRowIndex": 1,
                            "endRowIndex": 30
                        },
                        "shiftDimension": "Rows"
                    }
                }
            ]
        )
        // inserting the update data in sheet
        const moreRows = await sheet.addRows(data)
    }

    // if file does not exist then it will call createFile function to create file their
    if (!README.length && !CHANGE.length) {
        return createFile();
    }

    // watching files if there is any update it will call updateFile function or updateSheet
    chokidar.watch(['README.md', 'CHANGELOG.md', 'package.json']).on('all', async (evt, name) => {
        console.log("wohooo! Here you go. Make changes to see on the drive!")
        if (evt == 'change') {
            let fileId;
            let mimeType;
            if (name === 'README.md') {
                fileId = README[0].id;
                mimeType = README[0].mimeType;
                data = fs.createReadStream(`./${name}`)
                updateFile(name, fileId, mimeType, data)
            }

            else if (name === 'package.json') {
                const package = require('./package.json')
                const dependenciesList = Object.keys(package.dependencies)
                const versionList = Object.values(package.dependencies)
                const listOfPackageVersion = []
                for (var i = 0; i < dependenciesList.length; i++) {
                    listOfPackageVersion.push({ name: dependenciesList[i], version: versionList[i] })
                }
                updateSheet(listOfPackageVersion)
            }

            else if (name === 'CHANGELOG.md') {
                fileId = CHANGE[0].id;
                mimeType = CHANGE[0].mimeType;
                updateFile(name, fileId, mimeType)
                data = fs.createReadStream(`./${name}`)
                updateFile(name, fileId, mimeType, data)
            }
        }
    });
}

Samaaru();

app.listen(PORT, () => {
    console.log('wait till object creation is in process ........')
})