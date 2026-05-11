const express = require("express");
const crypto = require("crypto");
const moment = require("moment");
const cors = require("cors");

const app = express();

/* =========================
   MIDDLEWARE
========================= */

app.use(express.json());
app.use(cors());

/* =========================
   CONFIG VNPAY
========================= */

const CONFIG = {

    tmnCode: "VBDRQZWZ",

    secretKey:
        "KRM9ZW6JP06FMWF348THT70QQ6AQ3SVU",

    vnpUrl:
        "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",

    returnUrl:
        "https://bookingmovie.onrender.com/api/payment/return"
};

/* =========================
   HELPER
========================= */

// Sort object theo alphabet
function sortObject(obj) {

    return Object.keys(obj)
        .sort()
        .reduce((result, key) => {

            result[key] = obj[key];

            return result;

        }, {});
}

// Tạo Secure Hash
function createSecureHash(data, secretKey) {

    const signData =
        new URLSearchParams(data).toString();

    return crypto
        .createHmac("sha512", secretKey)
        .update(Buffer.from(signData, "utf-8"))
        .digest("hex");
}

// Lấy IP client
function getClientIp(req) {

    return (
        req.headers["x-forwarded-for"]
            ?.split(",")[0]
            .trim()
        ||
        req.headers["x-real-ip"]
        ||
        req.socket.remoteAddress
        ||
        "127.0.0.1"
    );
}

/* =========================
   CREATE PAYMENT URL
========================= */

app.get("/api/payment/create-url", (req, res) => {

    try {

        // Lấy amount
        const amount =
            Number(req.query.amount) || 50000;

        // Lấy orderInfo
        const orderInfo =
            req.query.orderInfo ||
            "Thanh toan mac dinh";

        // Tạo orderId
        const orderId =
            moment().format("YYYYMMDDHHmmss");

        // Ngày tạo
        const createDate =
            moment().format("YYYYMMDDHHmmss");

        // Params VNPAY
        let vnp_Params = {

            vnp_Version: "2.1.0",

            vnp_Command: "pay",

            vnp_TmnCode: CONFIG.tmnCode,

            vnp_Locale: "vn",

            vnp_CurrCode: "VND",

            vnp_TxnRef: orderId,

            vnp_OrderInfo: orderInfo,

            vnp_OrderType: "other",

            // VNPAY yêu cầu x100
            vnp_Amount: amount * 100,

            vnp_ReturnUrl: CONFIG.returnUrl,

            vnp_IpAddr: getClientIp(req),

            vnp_CreateDate: createDate
        };

        // Sort params
        vnp_Params = sortObject(vnp_Params);

        // Query string
        const signData =
            new URLSearchParams(vnp_Params).toString();

        // Hash
        const secureHash =
            createSecureHash(
                vnp_Params,
                CONFIG.secretKey
            );

        // Final URL
        const paymentUrl =
            `${CONFIG.vnpUrl}?${signData}&vnp_SecureHash=${secureHash}`;

        // Response
        return res.status(200).json({

            status: "success",

            orderId,

            amount,

            orderInfo,

            paymentUrl
        });

    } catch (error) {

        return res.status(500).json({

            status: "error",

            message: error.message
        });
    }
});

/* =========================
   RETURN FROM VNPAY
========================= */

app.get("/api/payment/return", (req, res) => {

    try {

        let vnp_Params = req.query;

        // Hash từ VNPAY gửi về
        const secureHash =
            vnp_Params.vnp_SecureHash;

        // Xóa hash cũ
        delete vnp_Params.vnp_SecureHash;
        delete vnp_Params.vnp_SecureHashType;

        // Sort lại
        vnp_Params = sortObject(vnp_Params);

        // Tạo hash verify
        const verifyHash =
            createSecureHash(
                vnp_Params,
                CONFIG.secretKey
            );

        // Check hash
        if (secureHash !== verifyHash) {

            return res.status(400).json({

                status: "failed",

                message: "Invalid signature"
            });
        }

        // Check trạng thái
        const isSuccess =
            vnp_Params.vnp_ResponseCode === "00";

        return res.status(200).json({

            status:
                isSuccess
                    ? "success"
                    : "failed",

            message:
                isSuccess
                    ? "Thanh toán thành công"
                    : "Thanh toán thất bại",

            orderId:
                vnp_Params.vnp_TxnRef,

            amount:
                vnp_Params.vnp_Amount / 100,

            orderInfo:
                vnp_Params.vnp_OrderInfo,

            responseCode:
                vnp_Params.vnp_ResponseCode
        });

    } catch (error) {

        return res.status(500).json({

            status: "error",

            message: error.message
        });
    }
});

/* =========================
   HOME
========================= */

app.get("/", (req, res) => {

    res.json({

        status: "success",

        message: "VNPAY API is running"
    });
});

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log("====================================");

    console.log(
        `SERVER RUNNING:
http://localhost:${PORT}`
    );

    console.log("====================================");

    console.log("TEST API:");

    console.log(
        `https://bookingmovie.onrender.com/api/payment/create-url?amount=1000&orderInfo=TEST+POSTMAN`
    );

    console.log("====================================");
});
