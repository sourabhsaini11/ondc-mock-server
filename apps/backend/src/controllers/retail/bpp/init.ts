import { NextFunction, Request, Response } from "express";
import {
  responseBuilder,
  redis,
  send_nack,
  Item,
  Fulfillment,
  Breakup,
  quoteCreatorB2c,
  B2C_EXAMPLES_PATH,
  B2B_EXAMPLES_PATH,
  VERSION,
} from "../../../lib/utils";
import fs from "fs";
import path from "path";
import YAML from "yaml";
interface Item_id_name {
  [key: string]: string;
}
export const initController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { transaction_id } = req.body.context;
    const VERSION = await redis.get(`${transaction_id}-version`)
    // const parts = VERSION[0].split('-');
    const version = VERSION;


    const transactionKeys = await redis.keys(`${transaction_id}-*`);

    // checking on_select response exits or not
    const ifTransactionExist = transactionKeys.filter((e) =>
      e.includes("on_select-from-server")
    );

    if (ifTransactionExist.length === 0) {
      return send_nack(res, "On Select doesn't exist");
    }
    //
    const ifToTransactionExist = transactionKeys.filter((e) =>
      e.includes("on_search-to-server")
    );

    const ifFromTransactionExist = transactionKeys.filter((e) =>
      e.includes("on_search-from-server")
    );

    if (
      ifFromTransactionExist.length === 0 &&
      ifToTransactionExist.length === 0
    ) {
      return send_nack(res, "On Search doesn't exist");
    }
    const transaction = await redis.mget(
      ifFromTransactionExist.length > 0
        ? ifFromTransactionExist
        : ifToTransactionExist
    );
    const parsedTransaction = transaction.map((ele) => {
      return JSON.parse(ele as string);
    });

    const providers = parsedTransaction[0].request.message.catalog.providers;
    req.body.providersItems = providers[0];
    const item_id_name: Item_id_name[] = providers.map((pro: any) => {
      const mappedItems = pro.items.map((item: Item) => ({
        id: item.id,
        name: item.descriptor?.name,
      }));
      return mappedItems;
    });

    req.body.item_arr = item_id_name.flat();
    await initDomesticController(req, res, next);

  } catch (error) {
    return next(error);
  }
};

const initDomesticController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    let version
    const { context, message, providersItems } = req.body;
    const { items, fulfillments, billing, ...remainingMessage } =
      message.order;

    if (context?.location?.city?.code?.toLowerCase() === "un:sin" || context?.location?.city?.code?.toLowerCase() === "std:999") {
      version = "b2c"
    }

    version = await redis.get(
      `${req.body.context.transaction_id}-version`);
    // console.log("🚀 ~ version:", version)

    let file: any
    if (version === "b2c") {
      file = fs.readFileSync(
        path.join(B2C_EXAMPLES_PATH, "on_init/on_init_exports.yaml")
      );
    } else if (version === VERSION['b2b']) {
      file = fs.readFileSync(
        path.join(B2B_EXAMPLES_PATH, "on_init/on_init_domestic.yaml")
      );
    } else {
      console.log('here on init')
      file = fs.readFileSync(
        path.join(B2B_EXAMPLES_PATH, "on_init/on_init_exports.yaml")
      );

    }


    const response = YAML.parse(file.toString());

    let { type, collected_by, ...staticPaymentInfo } =
      response.value.message.order.payments[0];

    if (
      remainingMessage.payments[0].type === "PRE-FULFILLMENT" &&
      remainingMessage.payments[0].collected_by === "BAP"
    ) {
      staticPaymentInfo = {
        ...staticPaymentInfo,
        "@ondc/org/settlement_details": [
          {
            settlement_counterparty: "buyer-app",
            settlement_phase: "sale-amount",
            settlement_type: "upi",
            upi_address: "gft@oksbi",
            settlement_bank_account_no: "XXXXXXXXXX",
            settlement_ifsc_code: "XXXXXXXXX",
            beneficiary_name: "xxxxx",
            bank_name: "xxxx",
            branch_name: "xxxx",
          },
        ],
      };
    }

    let responseMessage;

    if (version === "b2b" || version === "b2b-exp") {
      
      let responseMessageb2b = {
        order: {
          items: [
            {
              id: items[0].id,
              fulfillment_ids: items[0].fulfillment_ids,
              quantity: items[0].quantity,
              tags: response.value.message.order.items[0].tags
            }
          ],
          fulfillments: fulfillments.map((each: Fulfillment) => ({
            ...each,

            tracking: true,
          })),
          cancellation_terms: response.value.message.order.cancellation_terms,
          billing,
          provider: {
            id: remainingMessage.provider.id,
          },
          provider_location: remainingMessage.provider.locations[0],
          payments: remainingMessage.payments.map((each: any) => ({
            ...each,
            ...staticPaymentInfo,
          })),
          tags: message.order.tags,
          quote: quoteCreatorB2c(message?.order?.items, providersItems?.items), 
      
        } 
      };
      if(context.location.city.code==="std:999"){
        (responseMessageb2b.order as any).documents = [
          {
            url: "https://seller_terms_url",
            label: "SELLER_TERMS"
          }
        ];
      }
      responseMessage = responseMessageb2b
      
    }
    else {
      let responseMessageb2c = {
        order: {
          items: [
            {
              id: items[0].id,
              fulfillment_ids: items[0].fulfillment_ids,
              quantity: items[0].quantity
            }
          ],
          fulfillments: fulfillments.map((each: Fulfillment) => ({
            id: each.id,
            stops: each.stops,
            type: each.type,
            tracking: true,
          })),
          cancellation_terms: response.value.message.order.cancellation_terms,
          tags: [
            {
              descriptor: {
                code: "bpp_terms",
              },
              list: [
                {
                  descriptor: {
                    code: "max_liability",
                  },
                  value: "2",
                },
                {
                  descriptor: {
                    code: "max_liability_cap",
                  },
                  value: "10000",
                },
                {
                  descriptor: {
                    code: "mandatory_arbitration",
                  },
                  value: "false",
                },
                {
                  descriptor: {
                    code: "court_jurisdiction",
                  },
                  value: "Bengaluru",
                },
                {
                  descriptor: {
                    code: "delay_interest",
                  },
                  value: "1000",
                },
              ],
            },
          ],
          billing,
          provider: {
            id: remainingMessage.provider.id,
            location: remainingMessage.provider.locations[0]
          },
          provider_location: remainingMessage.provider.locations[0],

          //  payments:response.value.message.order.payments,
          payments: remainingMessage.payments.map((each: any) => ({
            ...each,
            ...staticPaymentInfo,
            type:"PRE-FULFILLMENT"

          })),
          quote: quoteCreatorB2c(message?.order?.items, providersItems?.items),
        },
      };
      responseMessage = responseMessageb2c

    }


    try {
      responseMessage.order.quote.breakup.forEach((element: Breakup) => {
        if (element["@ondc/org/title_type"] === "item") {
          const id = element["@ondc/org/item_id"];
          const item = req.body.item_arr.find(
            (item: Item_id_name) => item.id == id
          );
          element.title = item.name;
        }
      });
    } catch (error) {
      return res.status(400).json({
        message: {
          ack: {
            status: "NACK",
          },
        },
        error: {
          message: "Item Name and ID not matching",
        },
      });
    }
    return responseBuilder(
      res,
      next,
      context,
      responseMessage,
      `${req.body.context.bap_uri}${req.body.context.bap_uri.endsWith("/") ? "on_init" : "/on_init"
      }`,
      `on_init`,
      "retail"
    );
  } catch (error) {
    next(error);
  }
};