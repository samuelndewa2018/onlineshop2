require("dotenv").config();
const Transaction = require("../model/transaction");
const datetime = require("node-datetime");
const axios = require("axios");
const request = require("request");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const ErrorHandler = require("../utils/ErrorHandler");
const pass_key = process.env.pass_key;

const short_code = process.env.SHORT_CODE;
const key = process.env.CONSUMER_KEY;
const secret = process.env.CONSUMER_SECRET;
const auth = new Buffer.from(`${key}:${secret}`).toString("base64");
const newPassword = () => {
  const dt = datetime.create();
  const formatted = dt.format("YmdHMS");
  const passString = short_code + pass_key + formatted;
  const base64Encoded = Buffer.from(passString).toString("base64");
  return base64Encoded;
};

//create token
exports.token = async (req, res, next) => {
  const key = process.env.CONSUMER_KEY;
  const secret = process.env.CONSUMER_SECRET;
  const auth = new Buffer.from(`${key}:${secret}`).toString("base64");

  await axios
    .get(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      {
        headers: {
          authorization: `Basic ${auth}`,
        },
      }
    )
    .then((res) => {
      token = res.data.access_token;
      next();
    })
    .catch((err) => {
      console.log(err);
    });
};

//stk push
exports.stkPush = catchAsyncErrors(async (req, res, next) => {
  const phone = req.body.phone.substring(1); //formated to 72190........
  const amount = req.body.amount;
  const date = new Date();
  const callbackurl = process.env.CALL_BACK_URL;
  const callbackroute = process.env.CALL_BACK_ROUTE;
  const timestamp =
    date.getFullYear() +
    ("0" + (date.getMonth() + 1)).slice(-2) +
    ("0" + date.getDate()).slice(-2) +
    ("0" + date.getHours()).slice(-2) +
    ("0" + date.getMinutes()).slice(-2) +
    ("0" + date.getSeconds()).slice(-2);

  const base64Encoded = Buffer.from(short_code + pass_key + timestamp).toString(
    "base64"
  );

  const password = base64Encoded;
  const headers = {
    Authorization: `Bearer ${token}`,
  };
  const stkUrl =
    "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest";
  let data = {
    BusinessShortCode: "174379",
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: amount,
    PartyA: `254${phone}`,
    PartyB: "174379",
    PhoneNumber: `254${phone}`,
    CallBackURL: `${callbackurl}/${callbackroute}`,
    AccountReference: "eShop",
    TransactionDesc: "Lipa na M-PESA",
  };
  try {
    await axios
      .post(stkUrl, data, {
        headers: headers,
      })
      .then((response) => {
        res.send(response.data);
      });
  } catch (error) {
    console.log(error);
    return next(
      new ErrorHandler(`Error occurred. Please try again${error}`, 500)
    );
  }
});

const callback_route = process.env.CALLBACK_ROUTE;
const callback_root = process.env.CALL_BACK_ROOT;
const callbackurl = process.env.CALL_BACK_URL;

//callback stk
exports.stkCallback = (req, res) => {
  if (!req.body.Body.stkCallback.CallbackMetadata) {
    console.log(req.body.Body.stkCallback.ResultDesc);
    res.status(200).json("ok");
    return;
  }

  const amount = req.body.Body.stkCallback.CallbackMetadata.Item[0].Value;
  const code = req.body.Body.stkCallback.CallbackMetadata.Item[1].Value;
  const phone1 =
    req.body.Body.stkCallback.CallbackMetadata.Item[4].Value.toString().substring(
      3
    );
  const phone = `0${phone1}`;
  const transaction = new Transaction();

  transaction.customer_number = phone;
  transaction.mpesa_ref = code;
  transaction.amount = amount;

  transaction
    .save()
    .then((data) => {
      console.log({ message: "transaction saved successfully", data });
    })
    .catch((err) => console.log(err.message));

  res.status(200).json("ok");
};

//stk query
exports.stkpushquery = catchAsyncErrors(async (req, res) => {
  const CheckoutRequestID = req.body.CheckoutRequestID;

  const date = new Date();
  const timestamp =
    date.getFullYear() +
    ("0" + (date.getMonth() + 1)).slice(-2) +
    ("0" + date.getDate()).slice(-2) +
    ("0" + date.getHours()).slice(-2) +
    ("0" + date.getMinutes()).slice(-2) +
    ("0" + date.getSeconds()).slice(-2);

  const passkey = process.env.MPESA_PASSKEY;

  const password = new Buffer.from(short_code + pass_key + timestamp).toString(
    "base64"
  );

  await axios

    .post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query",
      {
        BusinessShortCode: "174379",
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: CheckoutRequestID,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )
    .then((responce) => {
      res.status(200).json(responce.data);
    })
    .catch((err) => {
      // console.log(err.message);
      res.status(400).json(err);
    });
});

//withdrawal for seller
exports.withdrawal = catchAsyncErrors(async (req, res) => {
  getAccessToken()
    .then((accessToken) => {
      const securityCredential = process.env.SECURITY_CREDENTIAL;
      const url = "https://sandbox.safaricom.co.ke/mpesa/b2c/v1/paymentrequest",
        auth = "Bearer " + accessToken;
      request(
        {
          url: url,

          method: "POST",

          headers: {
            Authorization: auth,
          },

          json: {
            InitiatorName: "testapi",

            SecurityCredential: securityCredential,

            CommandID: "PromotionPayment",

            Amount: "1",

            PartyA: "600998",

            PartyB: "254712012113",

            Remarks: "Withdrawal",

            QueueTimeOutURL: `${callbackurl}/b2c/queue`,

            ResultURL: `${callbackurl}/b2c/result`,

            Occasion: "Withdrawal",
          },
        },
        function (error, response, body) {
          if (error) {
            console.log(error);
          }
          res.status(200).json(body);
          console.log(body);
        }
      );
    })
    .catch(console.log);
});

//access token function
function getAccessToken() {
  const consumer_key = process.env.CONSUMER_KEY; // REPLACE IT WITH YOUR CONSUMER KEY
  const consumer_secret = process.env.CONSUMER_SECRET; // REPLACE IT WITH YOUR CONSUMER SECRET
  const url =
    "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";
  const auth =
    "Basic " +
    new Buffer.from(consumer_key + ":" + consumer_secret).toString("base64");
  return new Promise((response, reject) => {
    request(
      {
        url: url,
        headers: {
          Authorization: auth,
        },
      },
      function (error, res, body) {
        var jsonBody = JSON.parse(body);
        if (error) {
          reject(error);
        } else {
          const accessToken = jsonBody.access_token;
          response(accessToken);
        }
      }
    );
  });
}
