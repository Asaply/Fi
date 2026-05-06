require('dotenv').config({ path: '.env.local' });
const belvo = require('belvo').default || require('belvo');

async function test() {
    try {
        const client = new belvo(
            process.env.BELVO_SECRET_ID,
            process.env.BELVO_SECRET_PASSWORD,
            process.env.BELVO_ENVIRONMENT || 'sandbox'
        );
        console.log("Client created");
        const tokenData = await client.widgetToken.create();
        console.log("Token:", tokenData);
    } catch (err) {
        console.error("Error:", err);
    }
}
test();
