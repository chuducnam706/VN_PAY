const express = require('express');
const crypto = require('crypto');
const moment = require('moment');
const cors = require('cors');

const app = express();

app.use(express.json());
app.use(cors());

// ======================
// API TẠO LINK THANH TOÁN
// ======================
app.get('/api/payment/create-url', (req, res) => {

    // Lấy amount và orderInfo từ query
    const amount = req.query.amount || 50000;

    // Nếu không truyền orderInfo thì dùng mặc định
    const orderInfo =
        req.query.orderInfo || 'Thanh toan mac dinh';

    // Tạo mã đơn hàng
    const orderId =
        moment(new Date()).format('YYYYMMDDHHmmss');

    // Cấu hình VNPAY
    const tmnCode = "VBDRQZWZ";
    const secretKey = "COVWQRQMQJ8RTAWRH3GXMEGYTIOZ60WV";

    const vnpUrl =
        "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";

    const returnUrl =
        "https://bookingmovie.onrender.com/api/payment/return";

    const createDate =
        moment(new Date()).format('YYYYMMDDHHmmss');

    // Params gửi sang VNPAY
    let vnp_Params = {
        'vnp_Version': '2.1.0',
        'vnp_Command': 'pay',
        'vnp_TmnCode': tmnCode,
        'vnp_Locale': 'vn',
        'vnp_CurrCode': 'VND',

        'vnp_TxnRef': orderId,

        // Nội dung thanh toán
        'vnp_OrderInfo': orderInfo,

        'vnp_OrderType': 'other',

        // VNPAY yêu cầu nhân 100
        'vnp_Amount': amount * 100,

        'vnp_ReturnUrl': returnUrl,

        'vnp_IpAddr': getClientIp(req),

        'vnp_CreateDate': createDate,
    };

    // Sắp xếp param
    vnp_Params = Object.keys(vnp_Params)
        .sort()
        .reduce((obj, key) => {
            obj[key] = vnp_Params[key];
            return obj;
        }, {});

    // Tạo secure hash
    const signData =
        new URLSearchParams(vnp_Params).toString();

    const hmac =
        crypto.createHmac("sha512", secretKey);

    const signed =
        hmac
            .update(Buffer.from(signData, 'utf-8'))
            .digest("hex");

    // Link thanh toán cuối cùng
    const finalPaymentUrl =
        vnpUrl +
        '?' +
        signData +
        '&vnp_SecureHash=' +
        signed;

    // Response
    res.status(200).json({
        status: "success",
        orderId: orderId,
        amount: amount,
        orderInfo: orderInfo,
        paymentUrl: finalPaymentUrl
    });
});

// ======================
// API RETURN TỪ VNPAY
// ======================
app.get('/api/payment/return', (req, res) => {

    let vnp_Params = req.query;

    const secretKey =
        "COVWQRQMQJ8RTAWRH3GXMEGYTIOZ60WV";

    const secureHash =
        vnp_Params['vnp_SecureHash'];

    // Xóa hash để verify
    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    // Sort param
    vnp_Params = Object.keys(vnp_Params)
        .sort()
        .reduce((obj, key) => {
            obj[key] = vnp_Params[key];
            return obj;
        }, {});

    // Tạo hash verify
    const signData =
        new URLSearchParams(vnp_Params).toString();

    const hmac =
        crypto.createHmac("sha512", secretKey);

    const signed =
        hmac
            .update(Buffer.from(signData, 'utf-8'))
            .digest("hex");

    // Check hash
    if (secureHash === signed) {

        const responseCode =
            vnp_Params['vnp_ResponseCode'];

        // Thành công
        if (responseCode === '00') {

            res.status(200).json({
                status: "success",
                message: "Thanh toán thành công",

                orderId:
                    vnp_Params['vnp_TxnRef'],

                amount:
                    vnp_Params['vnp_Amount'] / 100,

                orderInfo:
                    vnp_Params['vnp_OrderInfo']
            });

        } else {

            res.status(200).json({
                status: "failed",
                message: "Thanh toán thất bại",
                responseCode: responseCode
            });
        }

    } else {

        res.status(400).json({
            status: "failed",
            message: "Chữ ký không hợp lệ"
        });
    }
});

// ======================
// LẤY IP CLIENT
// ======================
function getClientIp(req) {

    return (
        req.headers['x-forwarded-for']
            ?.split(',')[0]
            .trim()
        ||
        req.headers['x-real-ip']
        ||
        req.socket.remoteAddress
        ||
        '127.0.0.1'
    );
}

// ======================
// START SERVER
// ======================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log("-----------------------------------------");

    console.log(
        `SERVER ĐANG CHẠY TẠI:
https://bookingmovie.onrender.com`
    );

    console.log(
        `TEST:
https://bookingmovie.onrender.com/api/payment/create-url?amount=1000&orderInfo=TEST+POSTMAN`
    );

    console.log("-----------------------------------------");
});
