import {Bot, InlineKeyboard} from "grammy";
import dotenv from "dotenv";

dotenv.config();

// maps the chat id to a map of <user id to wallet>
const chats = new Map<number, Map<number, string>>();

//Create a new bot
const bot = new Bot(process.env.BOT_API_KEY!!);

bot.command("addwallet", async (ctx) => {
    // get the chat id and store the user's information plus its wallet to the current chat.
    // we should also allow the user to add their wallet to the overall bot database if requested.
    const wallet = ctx.message?.text?.split(" ")?.[1];
    if (wallet) {
        const chat_id = (await ctx.getChat()).id;
        const item = (chats.has(chat_id) ? chats : chats.set(chat_id, new Map())).get(chat_id);
        item?.set(ctx.from!!.id, wallet);
    }
})


//Pre-assign menu text
const startMenu = "<b>web3telbot</b>\n\nWelcome to web3telbot.\n\nWe need to configure the bot using the buttons below or you can run the following commands\n/addwallet (address)";

//Pre-assign button text
const connectWalletButton = "Connect your wallet";

//Build keyboards
const firstMenuMarkup = new InlineKeyboard().text(connectWalletButton).text('do something else');

//This handler sends a menu with the inline buttons we pre-assigned above
bot.command("start", async (ctx) => {
    await ctx.reply(startMenu, {
        parse_mode: "HTML",
        reply_markup: firstMenuMarkup,
    });
});

bot.callbackQuery(connectWalletButton, async (ctx) => {
    //Update message content with corresponding menu section
    await ctx.editMessageText("Please enter your wallet address", {
        parse_mode: "HTML",
    });
});

/*
//This handler processes next button on the menu
bot.callbackQuery(nextButton, async (ctx) => {
    //Update message content with corresponding menu section
    await ctx.editMessageText(secondMenu, {
        reply_markup: secondMenuMarkup,
        parse_mode: "HTML",
    });
});
*/


//This function would be added to the dispatcher as a handler for messages coming from the Bot API
bot.on("message", async (ctx) => {
    //Print to console
    console.log(ctx.message)

    console.log(
        `${ctx.from.id} wrote ${
            "text" in ctx.message ? ctx.message.text : ""
        }`,
    );

    //This is equivalent to forwarding, without the sender's name
    await ctx.copyMessage(ctx.message.chat.id);
});

//Start the Bot
bot.start();
console.log("Bot started.");
