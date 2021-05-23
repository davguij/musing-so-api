import nodemailer from 'nodemailer';

import { ROUTE_URLS } from '../constants';

const transporter = nodemailer.createTransport({
  host: process.env.POSTMARK_HOST,
  port: 587,
  secure: false,
  auth: {
    user: process.env.POSTMARK_AUTH,
    pass: process.env.POSTMARK_AUTH,
  },
});

export function sendVerificationMail(
  recipient: string,
  userId: string,
  verificationCode: string
) {
  const verificationLink = `${process.env.BASE_URL}${ROUTE_URLS.users}/${userId}/${verificationCode}`;
  const message = {
    from: process.env.EMAIL_FROM_ADDRESS,
    to: recipient,
    subject: '[musing.so] Verify your email address',
    html: `Thanks for signing up at <strong>musing.so!</strong>.\nPlease visit the following link to verify your email address: <a href=${verificationLink}>${verificationLink}</a>\nSee you on the other side!`,
  };
  return transporter.sendMail(message);
}
