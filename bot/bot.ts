import {Bot, type Context, InlineKeyboard, InputFile, session} from "grammy";

import {MetaMaskSDK} from "@metamask/sdk";
import dotenv from "dotenv";
import {type Conversation, type ConversationFlavor, conversations, createConversation,} from "@grammyjs/conversations";

import qrcode from "qrcode";
import {BigNumber, ethers} from "ethers";
import {formatEther} from "ethers/lib/utils";
import axios from "axios";

const fs = require("fs");


dotenv.config();

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

function writeChatsToJson() {
    let objArray = Array.from(chats, ([key, value]) => [key, Object.fromEntries(value)]);
    let json = JSON.stringify(objArray);

    fs.writeFileSync("chats.json", json);
}

function loadChatsFromJson(): any {
    const data = fs.readFileSync("chats.json");
    let arr = JSON.parse(data);

    return new Map(arr.map(([key, value]: [string, string]) => [key, new Map(Object.entries(value))]));

}

function convertEthToWei(ethAmount: string): {
    weiAmount: ethers.BigNumber;
    hexAmount: string;
} {
    // Convert ether to wei
    const weiAmount = ethers.utils.parseEther(ethAmount);

    // Convert wei to hexadecimal
    const hexAmount = weiAmount.toHexString();

    return {weiAmount, hexAmount};
}

function weiToEth(wei: BigNumber): number {
    return +formatEther(wei);
}

function isNumber(value: string): boolean {
    // Use the unary plus operator to convert the string to a number
    // and check if it is a finite number
    return Number.isFinite(+value);
}

function isAddress(value: string): boolean {
    try {
        ethers.utils.getAddress(value);
        return true;
    } catch (e) {
        return false;
    }
}

async function getEtherPriceInEuros() {
    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=eur');
        return response.data.ethereum.eur;
    } catch (error) {
        console.error(error);
    }
}

// Metamask config
const sdk = new MetaMaskSDK({
    shouldShimWeb3: false,
});

const ethereum = sdk.getProvider();

// Bot config
type MyContext = Context & ConversationFlavor;
type MyConversation = Conversation<MyContext>;
// maps the chat id to a map of <user id to wallet>
const chats = loadChatsFromJson() || new Map<number, Map<string, string>>();
const bot = new Bot<MyContext>(process.env.BOT_API_KEY!!);

//Helper functions
async function registerWallet(
    wallet: string,
    chatId: number,
    username: string
) {
    if (wallet) {
        const item = (chats.has(chatId) ? chats : chats.set(chatId, new Map())).get(
            chatId
        );
        item?.set(username, wallet);
    }
    console.log("wallets", chats);
}

//Defines conversations
async function send(conversation: MyConversation, ctx: MyContext) {
    const accounts = ethereum?.request({
        method: "eth_requestAccounts",
        params: [],
    });
    await delay(2500);
    const link = sdk.getUniversalLink();
    // Generate the QR code as a PNG buffer
    const qrBuffer = await qrcode.toBuffer(link, {
        type: "png",
    });
    const qrInputFile = new InputFile(qrBuffer, "qr_code.png");
    // send the QR code as a document
    await ctx.replyWithPhoto(qrInputFile, {
        caption: "Scan this QR Code to connect your wallet",
    });
    await ctx.reply(
        "Or access the following link to connect your wallet: " + link
    );
    const parsedAccount = (await accounts) as string[];

    const chat = await ctx.getChat();
    await ctx.reply("Please enter the amount of tokens");
    const {message: amountMessage} = await conversation.wait();
    const amount = amountMessage?.text!!;
    if (!isNumber(amount)) {
        await ctx.reply(`${amount} it is not a valid number, please try again.`);
        await ctx.reply(startMenu, {
            parse_mode: "HTML",
            reply_markup: firstMenuMarkup,
        });
        return;
    }
    await ctx.reply("Please enter the receiver address");
    const {message: addressMessage} = await conversation.wait();

    const address = addressMessage?.text!!;

    if (!isAddress(address)) {
        await ctx.reply(`${address} it is not a valid address, please try again.`);
        await ctx.reply(startMenu, {
            parse_mode: "HTML",
            reply_markup: firstMenuMarkup,
        });
        return;
    }
    await ctx.reply("Please check your wallet to confirm the transaction");
    try {
        const answer = await ethereum?.request({
            method: "eth_sendTransaction",
            params: [
                {
                    from: parsedAccount[0],
                    to: address, //"0xC4955C0d639D99699Bfd7Ec54d9FaFEe40e4D272"
                    value: convertEthToWei(amount).hexAmount, // Only required to send ether to the recipient from the initiating external account.
                    // gasPrice: "0x09184e72a000", // Customizable by the user during MetaMask confirmation.
                    //gas: "0x2710", // Customizable by the user during MetaMask confirmation.
                },
            ],
        });
        // check answer if 4001 the error message. This happens when we reject the transaction on MM
        console.log(answer);
        await ctx.reply(
            "Transaction sent to address: " + address + " with amount: " + amount
        );
        // ask client if he wants to save his wallet to the database
        // and also if there is none yet
        await registerWallet(parsedAccount[0], chat.id, ctx.from!!.username!!);
        writeChatsToJson();
        await ctx.reply("Done sending");
    } catch (e) {
        console.log(e);
        await ctx.reply("Transaction failed");
    } finally {
        await ctx.reply(startMenu, {
            parse_mode: "HTML",
            reply_markup: firstMenuMarkup,
        });
    }
}

async function sendUsername(conversation: MyConversation, ctx: MyContext) {
    const accounts = ethereum?.request({
        method: "eth_requestAccounts",
        params: [],
    });
    await delay(2500);
    const link = sdk.getUniversalLink();
    // Generate the QR code as a PNG buffer
    const qrBuffer = await qrcode.toBuffer(link, {
        type: "png",
    });
    const qrInputFile = new InputFile(qrBuffer, "qr_code.png");
    // send the QR code as a document
    await ctx.replyWithPhoto(qrInputFile, {
        caption: "Scan this QR Code to connect your wallet",
    });
    await ctx.reply(
        "Or access the following link to connect your wallet: " + link
    );
    const parsedAccount = (await accounts) as string[];
    const chat = await ctx.getChat();

    await ctx.reply("Please enter the amount of tokens");
    const {message: amountMessage} = await conversation.wait();
    const amount = amountMessage?.text!!;
    await ctx.reply("What username do you want to send to?");
    const {message: usernameMessage} = await conversation.wait();
    const address = usernameMessage?.text!!;
    const wallet = chats.get(chat.id)?.get(address);

    if (wallet) {
        await ctx.reply(`Transferring ${amount} to ${address}`);
        await ctx.reply("Please check your wallet to confirm the transaction");
        try {
            const answer = await ethereum?.request({
                method: "eth_sendTransaction",
                params: [
                    {
                        from: parsedAccount[0],
                        to: "0xC4955C0d639D99699Bfd7Ec54d9FaFEe40e4D272", //"0xC4955C0d639D99699Bfd7Ec54d9FaFEe40e4D272"
                        value: "0x38D7EA4C68000", // Only required to send ether to the recipient from the initiating external account.
                        // gasPrice: "0x09184e72a000", // Customizable by the user during MetaMask confirmation.
                        //gas: "0x2710", // Customizable by the user during MetaMask confirmation.
                    },
                ],
            });
            // check answer if 4001 the error message. This happens when we reject the transaction on MM
            console.log(answer);
            await ctx.reply(
                "Transaction sent to address: " + address + " with amount: " + amount
            );
            // ask client if he wants to save his wallet to the database
            // and also if there is none yet
            await registerWallet(parsedAccount[0], chat.id, ctx.from!!.username!!);
            await ctx.reply("Done sending");
        } catch (e) {
            console.log(e);
            await ctx.reply("Transaction failed");
        } finally {
            await ctx.reply(startMenu, {
                parse_mode: "HTML",
                reply_markup: firstMenuMarkup,
            });
        }
    } else {
        await ctx.reply("This username does not exist. We cannot proceed");
        await ctx.reply(startMenu, {
            parse_mode: "HTML",
            reply_markup: firstMenuMarkup,
        });
    }
}

async function balance(conversation: MyConversation, ctx: MyContext) {
    const accounts = ethereum?.request({
        method: "eth_requestAccounts",
        params: [],
    });
    await delay(2500);
    const link = sdk.getUniversalLink();
    // Generate the QR code as a PNG buffer
    const qrBuffer = await qrcode.toBuffer(link, {
        type: "png",
    });
    const qrInputFile = new InputFile(qrBuffer, "qr_code.png");
    // send the QR code as a document
    await ctx.replyWithPhoto(qrInputFile, {
        caption: "Scan this QR Code to connect your wallet",
    });
    await ctx.reply(
        "Or access the following link to connect your wallet: " + link
    );
    const parsedAccount = (await accounts) as string[];

    try {
        const answer = await ethereum?.request({
            method: "eth_getBalance",
            params: [parsedAccount[0], "latest"],
        });
        // check answer if 4001 the error message. This happens when we reject the transaction on MM
        console.log(answer);
        await ctx.reply(
            "Balance: " + (weiToEth(answer as BigNumber)) + " ETH",
        );
    } catch (e) {
        console.log(e);
        await ctx.reply("Something went wrong");
    } finally {
        await ctx.reply(startMenu, {
            parse_mode: "HTML",
            reply_markup: firstMenuMarkup,
        });
    }
}

async function ethToFiat(conversation: MyConversation, ctx: MyContext) {
    const accounts = ethereum?.request({
        method: "eth_requestAccounts",
        params: [],
    });
    await delay(2500);
    const link = sdk.getUniversalLink();
    // Generate the QR code as a PNG buffer
    const qrBuffer = await qrcode.toBuffer(link, {
        type: "png",
    });
    const qrInputFile = new InputFile(qrBuffer, "qr_code.png");
    // send the QR code as a document
    await ctx.replyWithPhoto(qrInputFile, {
        caption: "Scan this QR Code to connect your wallet",
    });
    await ctx.reply(
        "Or access the following link to connect your wallet: " + link
    );
    const parsedAccount = (await accounts) as string[];

    try {
        const answer = await ethereum?.request({
            method: "eth_getBalance",
            params: [parsedAccount[0], "latest"],
        });
        // check answer if 4001 the error message. This happens when we reject the transaction on MM
        console.log(answer);
        await ctx.reply(
            "Balance: " + (weiToEth(answer as BigNumber)) * (await getEtherPriceInEuros()) + " EUR",
        );
    } catch (e) {
        console.log(e);
        await ctx.reply("Something went wrong");
    } finally {
        await ctx.reply(startMenu, {
            parse_mode: "HTML",
            reply_markup: firstMenuMarkup,
        });
    }
}

bot.use(
    session({
        initial() {
            // return empty object for now
            return {};
        },
    })
);
bot.use(conversations());

bot.use(createConversation(send));
bot.use(createConversation(sendUsername));
bot.use(createConversation(balance));
bot.use(createConversation(ethToFiat));

//Defines commands
bot.command("start", async (ctx) => {
    await ctx.reply(startMenu, {
        parse_mode: "HTML",
        reply_markup: firstMenuMarkup,
    });
});

//Pre-assign menu text
const startMenu =
    "<b>web3telbot</b>\n\nWelcome to web3telbot.\n\nUse the buttons below to navigate the bot.";
const mmMenu = "<b>web3telbot</b>\n\nSelect what you want to do";

//Pre-assign button text
const useYourMetaMaskWalletButton = "Use your MetaMask wallet";

const sendToAddressButton = "Send";
const sendToUsernameButton = "Send to username";
const balanceButton = "Balance";
const balanceInEurButton = "Balance in EUR";

//Build keyboards
const firstMenuMarkup = new InlineKeyboard().text(useYourMetaMaskWalletButton);
const mmMenuMarkup = new InlineKeyboard()
    .text(sendToAddressButton)
    .text(sendToUsernameButton)
    .row()
    .text(balanceButton)
    .text(balanceInEurButton);


bot.callbackQuery(useYourMetaMaskWalletButton, async (ctx) => {
    //Update message content with corresponding menu section
    await ctx.editMessageText(mmMenu, {
        parse_mode: "HTML",
        reply_markup: mmMenuMarkup,
    });
});

bot.callbackQuery(sendToAddressButton, async (ctx) => {
    await ctx.conversation.enter("send");
});

bot.callbackQuery(sendToUsernameButton, async (ctx) => {
    await ctx.conversation.enter("sendUsername");
});

bot.callbackQuery(balanceButton, async (ctx) => {
    await ctx.conversation.enter("balance");
});

bot.callbackQuery(balanceInEurButton, async (ctx) => {
    await ctx.conversation.enter("ethToFiat");
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
    console.log(ctx.message);

    console.log(
        `${ctx.from.id} wrote ${"text" in ctx.message ? ctx.message.text : ""}`
    );

    //This is equivalent to forwarding, without the sender's name
    //await ctx.copyMessage(ctx.message.chat.id);
});

//Start the Bot
bot.start();
console.log("Bot started.");
