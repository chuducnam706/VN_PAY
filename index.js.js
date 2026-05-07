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
    const returnUrl = "https://google.com"; 

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
        'vnp_IpAddr': '127.0.0.1', 
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

// Chạy server trên cổng 3000
const PORT = 3000;
app.listen(PORT, () => {
    console.log("-----------------------------------------");
    console.log(`SERVER ĐANG CHẠY TẠI: http://localhost:${PORT}`);
    console.log(`LINK TEST THANH TOÁN: http://localhost:${PORT}/api/payment/create-url?amount=50000`);
    console.log("-----------------------------------------");
});