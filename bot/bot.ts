import {Bot, type Context, InlineKeyboard, session} from "grammy";

import {MetaMaskSDK} from "@metamask/sdk"
import dotenv from "dotenv";
import {type Conversation, type ConversationFlavor, conversations, createConversation} from "@grammyjs/conversations";

dotenv.config();

// Metamask config
const sdk = new MetaMaskSDK({
    shouldShimWeb3: false,
});

const ethereum = sdk.getProvider();
ethereum?.request({
    method: "eth_requestAccounts",
    params: [],
});

// Bot config
type MyContext = Context & ConversationFlavor;
type MyConversation = Conversation<MyContext>;
// maps the chat id to a map of <user id to wallet>
const chats = new Map<number, Map<number, string>>();

//Create a new bot
const bot = new Bot<MyContext>(process.env.BOT_API_KEY!!);

//Helper functions
async function registerWallet(wallet: string, chatId: number, userId: number) {
    if (wallet) {
        const item = (chats.has(chatId) ? chats : chats.set(chatId, new Map())).get(chatId);
        item?.set(userId, wallet);
    }
    console.log("wallets", chats);
}

//Defines conversations
async function registerWalletConversation(conversation: MyConversation, ctx: MyContext) {
    await ctx.reply("Start by entering your wallet address");
    const {message} = await conversation.wait();
    const wallet = message?.text!!;
    await registerWallet(wallet, (await ctx.getChat()).id, ctx.from!!.id);
    await ctx.reply(`Registered your wallet: ${wallet}!`);
}

bot.use(session({
    initial() {
        // return empty object for now
        return {};
    },
}));
bot.use(conversations());

bot.use(createConversation(registerWalletConversation));

//Defines commands
bot.command("addwallet", async (ctx) => {
    // get the chat id and store the user's information plus its wallet to the current chat.
    // we should also allow the user to add their wallet to the overall bot database if requested.
    const link = sdk.getUniversalLink();
    const wallet = ctx.message?.text?.split(" ")?.[1]!!;
    await registerWallet(wallet, (await ctx.getChat()).id, ctx.from!!.id);
    await ctx.reply(link);
})

bot.command("send", async (ctx) => {
    const chat_id = (await ctx.getChat()).id;
    const toAccount = ctx.message?.text?.split(" ")?.[1];
    const amount = ctx.message?.text?.split(" ")?.[2]; // how to use?
    await ethereum?.request({
        method: "eth_sendTransaction",
        params: [
            {
                from: chats.get(chat_id)?.get(ctx.from!!.id),
                to: toAccount, //"0xC4955C0d639D99699Bfd7Ec54d9FaFEe40e4D272"
                value: "0x38D7EA4C68000", // Only required to send ether to the recipient from the initiating external account.
                // gasPrice: "0x09184e72a000", // Customizable by the user during MetaMask confirmation.
                //gas: "0x2710", // Customizable by the user during MetaMask confirmation.
            },
        ],
    })
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
    await ctx.conversation.enter("registerWalletConversation");
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

bot.use((ctx) => ctx.reply("What a nice update."));

//Start the Bot
bot.start();
console.log("Bot started.");
