const nodemailer = require('nodemailer');
const {google} = require('googleapis');
const OAuth = google.auth.OAuth2;
const env = require('./config.gmail.env');



const oauth2Client = new OAuth(
    env.ClientID,
    env.client_secret,
    env.redirect_url
)

oauth2Client.setCredentials({
    refresh_token: env.refresh_token
});


const accessToken = oauth2Client.getAccessToken();


async function sendTextEmail(to,subject,body,attachments) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            type: 'OAuth2',
            user: env.emailId,
            clientId: env.ClientID,
            clientSecret: env.client_secret,
            refreshToken: env.refresh_token,
            accessToken: accessToken
        },
        tls: {
            rejectUnauthorized: false
        }

    });

    var mailOptions = {
        from: env.emailId, // sender address
        to: to,            // list of receivers
        subject: subject,  // Subject line
        text: body,
        attachments: attachments        // plain text body
    };
    transporter.sendMail(mailOptions, function (error,info) {
        if(error) {
            console.log(error);       
        }
        else {
            console.log('Email sent: ' + info.response);
        }
    });
}

module.exports.sendTextEmail = sendTextEmail;
