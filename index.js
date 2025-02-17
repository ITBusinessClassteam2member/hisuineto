const { Client, middleware } = require("@line/bot-sdk");
const express = require("express");
require("dotenv").config();

const app = express();

// LINE Messaging API�̐ݒ�
const config = {
  channelSecret: process.env.CHANNEL_SECRET,
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
};

// Firebase�L�[�̓ǂݍ���
const firebaseKey = process.env.FIREBASE_KEY_PATH;
let firebaseServiceAccount;

try {
  firebaseServiceAccount = JSON.parse(firebaseKey);
  console.log("Firebase key loaded successfully.");
} catch (error) {
  console.error("Failed to load Firebase key:", error);
  process.exit(1);
}

// Firebase Admin SDK�̏�����
const admin = require("firebase-admin");
admin.initializeApp({
  credential: admin.credential.cert(firebaseServiceAccount),
});

const db = admin.firestore();

// LINE�N���C�A���g�̍쐬
const client = new Client(config);

// Content-Type�w�b�_�[��ݒ�
app.use((req, res, next) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  next();
});

// middleware�̓K�p
app.use(middleware(config));

// Webhook�G���h�|�C���g
app.post("/webhook", (req, res) => {
  console.log("Received webhook event:", JSON.stringify(req.body, null, 2));

  Promise.all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error("Error processing event:", err);
      res.status(500).end();
    });
});

// �C�x���g�����֐�
async function handleEvent(event) {
  if (event.type === "message" && event.message.type === "text") {
    const receivedMessage = event.message.text;
    console.log(`��M�������b�Z�[�W: ${receivedMessage}`);

    const docRef = db.collection("message").doc(receivedMessage);
    const doc = await docRef.get();

    if (doc.exists) {
      const responseMessage = doc.data().response;

      if (responseMessage.startsWith("http")) {
        // �摜URL�̏ꍇ�A�摜���b�Z�[�W�𑗐M
        return client.replyMessage(event.replyToken, {
          type: "image",
          originalContentUrl: responseMessage,
          previewImageUrl: responseMessage,
        });
      } else {
        // �ʏ�̃e�L�X�g���b�Z�[�W
        return client.replyMessage(event.replyToken, {
          type: "text",
          text: responseMessage,
        });
      }
    } else {
      console.log("No response found for the message.");
      return client.replyMessage(event.replyToken, {
        type: "text",
        text: "���݂܂���A���̃��b�Z�[�W�ɂ͑Ή��ł��܂���B",
      });
    }
  }

  // �|�X�g�o�b�N�C�x���g�̏���
  if (event.type === "postback") {
    const postbackData = event.postback.data;

    if (postbackData.startsWith("feedback:")) {
      const feedback = postbackData.replace("feedback:", "");
      console.log(`Feedback received: ${feedback}`);

      await db.collection("feedback").add({
        feedback,
        timestamp: new Date(),
      });

      return client.replyMessage(event.replyToken, {
        type: "text",
        text: "�����͂��肪�Ƃ��������܂��I",
      });
    }
  }
}


// �T�[�o�[�N��
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
