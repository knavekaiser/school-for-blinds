import nodemailer from "nodemailer";

let transporter = nodemailer.createTransport({
  host: "mail.schoolForBlinds.com",
  port: 465,
  secure: true,
  auth: {
    user: "contact@schoolForBlinds.com",
    pass: process.env.CONTACT_MAIL_PASS,
  },
});

export default function sendMail(message) {
  return new Promise(async (resolve, reject) => {
    try {
      let info = await transporter.sendMail({
        from: {
          name: "School for Blinds",
          address: "contact@schoolForBlinds.com",
        },
        ...message,
      });
      info.success = !!info.accepted?.length;
      resolve(info);
    } catch (err) {
      reject(err);
    }
  });
}
