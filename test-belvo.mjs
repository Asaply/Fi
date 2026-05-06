import 'dotenv/config';
import belvo from 'belvo';

async function test() {
    try {
        console.log("ID:", process.env.BELVO_SECRET_ID);
        // Do not print full password for security, just first 5 chars
        console.log("ENV:", process.env.BELVO_ENVIRONMENT);
        
        const client = new belvo(
            process.env.BELVO_SECRET_ID,
            process.env.BELVO_SECRET_PASSWORD,
            process.env.BELVO_ENVIRONMENT || 'sandbox'
        );
        console.log("Client created");
        
        const tokenData = await client.widgetToken.create();
        console.log("Token:", tokenData);
    } catch (err) {
        console.error("Error generating token:", err);
    }
}

test();
