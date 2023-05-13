import { Bot, type Context, InlineKeyboard, session, InputFile } from "grammy";

import { MetaMaskSDK } from "@metamask/sdk";
import dotenv from "dotenv";
import {
  type Conversation,
  type ConversationFlavor,
  conversations,
  createConversation,
} from "@grammyjs/conversations";

import qrcode from "qrcode";

dotenv.config();

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

// Metamask config
const sdk = new MetaMaskSDK({
  shouldShimWeb3: false,
});

const ethereum = sdk.getProvider();
/*
To have a smart way to send money over, we have some approaches:
- We can store the username instead of the userID and check if we have the wallet of that username, if yes, we continue and do the transaction. If not we respond with error
- We can make all the users admins, and we can see the admins of the chat, that makes it so that we can access their user id and do the same as above.

We can set the 'privacy' level of the wallet as well
- The user can decide if the wallet is exposed to all the chats that he is in with the bot
- Or the user can check if the wallet is exposed only to that specific chat

 */

// Bot config
type MyContext = Context & ConversationFlavor;
type MyConversation = Conversation<MyContext>;
// maps the chat id to a map of <user id to wallet>
const chats = new Map<number, Map<string, string>>();

//Create a new bot
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
  const chat = await ctx.getChat();
  const link = sdk.getUniversalLink();

  // Generate the QR code as a PNG buffer
  const qrBuffer = await qrcode.toBuffer(link, {
    type: "png",
  });

  // Send the photo
  const qrInputFile = new InputFile(qrBuffer, "qr_code.png");
  // send the QR code as a document

  await ctx.replyWithPhoto(qrInputFile, {
    caption: "Scan this QR Code to connect your wallet",
  });

  await ctx.reply(
    "Or access the following link to connect your wallet: " + link
  );
  const parsedAccount = (await accounts) as string[];

  await ctx.reply("Please enter the amount of tokens");
  const { message: amountMessage } = await conversation.wait();

  const amount = amountMessage?.text!!;

  await ctx.reply("Please enter the receiver address");
  const { message: addressMessage } = await conversation.wait();
  const address = addressMessage?.text!!;
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
    const wallet = ctx.message?.text!!;
    await registerWallet(wallet, chat.id, ctx.from!!.username!!);
  } catch (e) {
    console.log(e);
    await ctx.reply("Transaction failed");
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

//Defines commands
bot.command("addwallet", async (ctx) => {
  // get the chat id and store the user's information plus its wallet to the current chat.
  // we should also allow the user to add their wallet to the overall bot database if requested.
  const wallet = ctx.message?.text?.split(" ")?.[1]!!;
  await registerWallet(wallet, (await ctx.getChat()).id, ctx.from!!.username!!);
  await ctx.reply(`Registered your wallet: ${wallet}!`);
});

//Pre-assign menu text
const startMenu =
  "<b>web3telbot</b>\n\nWelcome to web3telbot.\n\nUse the buttons below to navigate the bot.";
const mmMenu = "<b>web3telbot</b>\n\nSelect what you want to do";

//Pre-assign button text
const useYourMetaMaskWalletButton = "Use your MetaMask wallet";

const sendButton = "Send";

//Build keyboards
const firstMenuMarkup = new InlineKeyboard().text(useYourMetaMaskWalletButton);
const mmMenuMarkup = new InlineKeyboard().text(sendButton);

//This handler sends a menu with the inline buttons we pre-assigned above
bot.command("start", async (ctx) => {
  await ctx.reply(startMenu, {
    parse_mode: "HTML",
    reply_markup: firstMenuMarkup,
  });
});

bot.callbackQuery(useYourMetaMaskWalletButton, async (ctx) => {
  //Update message content with corresponding menu section
  await ctx.reply(mmMenu, {
    parse_mode: "HTML",
    reply_markup: mmMenuMarkup,
  });
});

bot.callbackQuery(sendButton, async (ctx) => {
  await ctx.conversation.enter("send");
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
  await ctx.copyMessage(ctx.message.chat.id);
});

bot.use((ctx) => ctx.reply("What a nice update."));

//Start the Bot
bot.start();
console.log("Bot started.");
