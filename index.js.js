const express = require('express');
const crypto = require('crypto');
const moment = require('moment');
const cors = require('cors');

const app = express();

// Cấu hình để nhận dữ liệu JSON và cho phép App Android gọi API (CORS)
app.use(express.json());
app.use(cors()); 

// API tạo link thanh toán
app.get('/api/payment/create-url', (req, res) => {
    // 1. Lấy số tiền từ tham số 'amount' trên URL. Nếu không có, mặc định là 50000.
    const amount = req.query.amount || 50000;
    
    // 2. Tạo mã đơn hàng duy nhất bằng cách lấy thời gian hiện tại (năm tháng ngày giờ phút giây)
    // Giúp con test nhiều lần mà không bị báo trùng đơn hàng.
    const orderId = moment(new Date()).format('YYYYMMDDHHmmss');

    // 3. THÔNG TIN CẤU HÌNH VNPAY (Đã xóa dấu cách thừa ở TmnCode)
    const tmnCode = "VBDRQZWZ"; 
    const secretKey = "COVWQRQMQJ8RTAWRH3GXMEGYTIOZ60WV";
    const vnpUrl = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
    
    // Sau khi thanh toán xong, VNPAY sẽ chuyển hướng về trang này
    // Sử dụng domain công khai thay vì localhost
    const returnUrl = "https://bookingmovie.onrender.com/api/payment/return"; 

    let date = new Date();
    let createDate = moment(date).format('YYYYMMDDHHmmss');
    
    // 4. Thiết lập các tham số gửi sang VNPAY
    let vnp_Params = {
        'vnp_Version': '2.1.0',
        'vnp_Command': 'pay',
        'vnp_TmnCode': tmnCode,
        'vnp_Locale': 'vn',
        'vnp_CurrCode': 'VND',
        'vnp_TxnRef': orderId,
        'vnp_OrderInfo': 'Thanh toan ve xem phim tai datvexemphim.com',
        'vnp_OrderType': 'other',
        'vnp_Amount': amount * 100, // VNPAY yêu cầu số tiền nhân 100
        'vnp_ReturnUrl': returnUrl,
        'vnp_IpAddr': getClientIp(req), // Lấy IP thực của client
        'vnp_CreateDate': createDate,
    };

    // 5. Sắp xếp tham số theo bảng chữ cái (Bắt buộc)
    vnp_Params = Object.keys(vnp_Params).sort().reduce((obj, key) => {
        obj[key] = vnp_Params[key];
        return obj;
    }, {});

    // 6. Tạo chữ ký bảo mật Secure Hash
    const signData = new URLSearchParams(vnp_Params).toString();
    const hmac = crypto.createHmac("sha512", secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");
    
    // 7. Tạo URL cuối cùng để gửi về cho phía người dùng
    const finalPaymentUrl = vnpUrl + '?' + signData + '&vnp_SecureHash=' + signed;

    // Trả kết quả JSON về trình duyệt/App
    res.status(200).json({ 
        status: "success",
        orderId: orderId,
        amount: amount,
        paymentUrl: finalPaymentUrl 
    });
});

// API nhận kết quả từ VNPAY sau khi thanh toán
app.get('/api/payment/return', (req, res) => {
    let vnp_Params = req.query;
    
    const secretKey = "COVWQRQMQJ8RTAWRH3GXMEGYTIOZ60WV";
    let secureHash = vnp_Params['vnp_SecureHash'];
    
    // Xóa tham số vnp_SecureHash và vnp_SecureHashType để xác minh chữ ký
    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];
    
    // Sắp xếp và tạo chữ ký
    vnp_Params = Object.keys(vnp_Params).sort().reduce((obj, key) => {
        obj[key] = vnp_Params[key];
        return obj;
    }, {});
    
    const signData = new URLSearchParams(vnp_Params).toString();
    const hmac = crypto.createHmac("sha512", secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");
    
    // Kiểm tra chữ ký
    if (secureHash === signed) {
        const responseCode = vnp_Params['vnp_ResponseCode'];
        if (responseCode === '00') {
            res.status(200).json({
                status: "success",
                message: "Thanh toán thành công",
                orderId: vnp_Params['vnp_TxnRef'],
                amount: vnp_Params['vnp_Amount'] / 100
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

// Hàm lấy IP thực của client
function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0].trim() || 
           req.headers['x-real-ip'] || 
           req.socket.remoteAddress || 
           '127.0.0.1';
}

// Chạy server trên cổng từ biến môi trường hoặc mặc định 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("-----------------------------------------");
    console.log(`SERVER ĐANG CHẠY TẠI: https://bookingmovie.onrender.com`);
    console.log(`LINK TEST THANH TOÁN: https://bookingmovie.onrender.com/api/payment/create-url?amount=50000`);
    console.log("-----------------------------------------");
});
