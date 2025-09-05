const nodemailer = require('nodemailer');

// 1) create a transporter
const sendEmail = async (options) => {
  const transporter = nodemailer.createTransport({
    host: process.env.HOST,
    port: process.env.EMAIL_PORT, // أو 2525
    secure: false, // مهم
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  // 2) define the email options
  const mailOptions = {
    from: '"Ismail" <ismail@example.com>',
    to: options.email,
    subject: options.subject,
    text: options.message,
  };

  // 3) actually send the email
  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
