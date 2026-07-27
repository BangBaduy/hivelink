const { Resend } = require("resend");

const apiKey = "re_bLmLW97c_HrtUboNQdJDVqhvrX5zainTE";
const fromEmail = "no-reply@upvance.site";

async function main() {
  console.log("Testing Resend API with Key:", apiKey);
  const resend = new Resend(apiKey);

  try {
    const response = await resend.emails.send({
      from: `HiVE! <${fromEmail}>`,
      to: ["delivered@resend.dev"],
      subject: "Test Email from HiVE!",
      html: "<p>This is a test email to check Resend configuration.</p>",
    });

    console.log("Resend API Response:", response);

    if (response.error) {
      console.error("\n❌ Resend API Error:", response.error);
    } else {
      console.log("\n✅ Resend API SUCCESS! Email ID:", response.data.id);
    }
  } catch (err) {
    console.error("\n❌ Execution Error:", err);
  }
}

main();
