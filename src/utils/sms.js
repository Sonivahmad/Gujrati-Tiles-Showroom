export const FAST2SMS_API_KEY = "gQXZjkYWHToB6flxK27CqdrmF1sD5eOiyaUpNuPSJG830RLbhwuV7vez682SNaitqAHmE0srYylk9TQc";

export const sendReminderSms = async (phone, amount, shopName) => {
  try {
    const message = `Dear Customer, a payment of Rs. ${amount} is pending for your recent purchase at ${shopName || "our showroom"}. Kindly clear the dues. Thank you!`;
    
    // We use route 'q' for quick transactional SMS on Fast2SMS
    const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: {
        "authorization": FAST2SMS_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        route: "q",
        message: message,
        language: "english",
        flash: 0,
        numbers: phone
      })
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Fast2SMS Error:", error);
    return null;
  }
};
