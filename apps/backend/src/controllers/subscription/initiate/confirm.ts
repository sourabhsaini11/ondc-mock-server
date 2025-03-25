import { NextFunction, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import {
	MOCKSERVER_ID,
	send_response,
	send_nack,
	redisFetchToServer,
	SUBSCRIPTION_BAP_MOCKSERVER_URL,
} from "../../../lib/utils";
import {
	ACTTION_KEY,
	ON_ACTION_KEY,
} from "../../../lib/utils/actionOnActionKeys";
import { ERROR_MESSAGES } from "../../../lib/utils/responseMessages";
<<<<<<< Updated upstream
import { ORDER_STATUS, PAYMENT_STATUS, SUBSCRIPTION_DOMAINS } from "../../../lib/utils/apiConstants";
=======
import {
	ORDER_STATUS,
	PAYMENT_STATUS,
	SUBSCRIPTION_DOMAINS,
} from "../../../lib/utils/apiConstants";
import { schedule } from "node-cron";
>>>>>>> Stashed changes

export const initiateConfirmController = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		const { transactionId } = req.body;
		const { scenario } = req.query;
		const on_search = await redisFetchToServer(
			ON_ACTION_KEY.ON_SEARCH,
			transactionId
		);
		const providersItems = on_search?.message?.catalog?.providers[0]?.items;
		const on_init = await redisFetchToServer(
			ON_ACTION_KEY.ON_INIT,
			transactionId
		);
		if (!on_init) {
			return send_nack(res, ERROR_MESSAGES.ON_INIT_DOES_NOT_EXISTED);
		}
		return intializeRequest(res, next, on_init, scenario, providersItems);
	} catch (error) {
		return next(error);
	}
};

const intializeRequest = async (
	res: Response,
	next: NextFunction,
	transaction: any,
	scenario: any,
	providersItems: any
) => {
	try {
		const {
			context,
			message: {
				order: { provider, locations, payments, fulfillments, xinput, items },
			},
		} = transaction;
		console.log("items in confirm", items);
		console.log("payments in confirm", JSON.stringify(payments[0]));

		const { transaction_id } = context;
		const { stops, ...remainingfulfillments } = fulfillments[0];

		const timestamp = new Date().toISOString();
		console.log("fulfillments", fulfillments);
		const confirm = {
			context: {
				...context,
				timestamp: new Date().toISOString(),
				action: ACTTION_KEY.CONFIRM,
				bap_id: MOCKSERVER_ID,
				bap_uri: SUBSCRIPTION_BAP_MOCKSERVER_URL,
				message_id: uuidv4(),
			},
			message: {
				order: {
					...transaction.message.order,
					id: uuidv4(),
					status: ORDER_STATUS.CREATED.toUpperCase(),
					provider: {
						...provider,
						locations,
					},
					fulfillments:
						context.domain === SUBSCRIPTION_DOMAINS.AUDIO_VIDEO
							? [
									{
										...fulfillments[0],
										customer: {
											person: {
												name: "xyz",
											},
										},
									},
							  ]
							: fulfillments,
					payments: [
						{
							...payments[0],
							params: {
								...payments[0].params,
								transaction_id: uuidv4(),
							},
							status:(scenario === 'subscription-with-full-payments')?'PAID': PAYMENT_STATUS.NON_PAID,
							tags:payments[0].tags
						},
					],
					created_at: timestamp,
					updated_at: timestamp,
				},
			},
		};
		if (context.domain === SUBSCRIPTION_DOMAINS.AUDIO_VIDEO) {
			confirm.message.order.payments[0].status = "PAID";
			delete confirm.message.order.payments[0].url;
		}
		// if (context.domain === SUBSCRIPTION_DOMAINS.PRINT_MEDIA) {
		// 	confirm.message.order.fulfillments = [
		// 		{
		// 			...confirm.message.order.fulfillments[0],
		// 			customer: (scenario === 'susubscription-with-full-payments')?undefined:{
		// 				person: {
		// 					name: "Ramu",
		// 				},
		// 			},
		// 			stops: [
		// 				{
		// 					...confirm.message.order.fulfillments[0].stops[0],
		// 					location: (scenario === 'susubscription-with-full-payments')? undefined :{
		// 						address: "My House #, My buildin",
		// 						area_code: "560001",
		// 						city: {
		// 							name: "Bengaluru",
		// 						},
		// 						country: {
		// 							code: "IND",
		// 						},
		// 						gps: "12.974002,77.613458",
		// 						state: {
		// 							name: "Karnataka",
		// 						},
		// 					},
		// 					instructions:(scenario === 'susubscription-with-full-payments')? undefined : {
		// 						name: "Special Instructions",
		// 						short_desc: "Customer Special Instructions",
		// 					},
		// 				},
		// 			],
		// 		},
		// 	];
		// 	delete confirm.message.order.fulfillments[0].stops[0].time.days;
		// 	delete confirm.message.order.fulfillments[0].tags;
		// }
		console.log(scenario,"sccccccc")
		if (scenario === "subscription-with-full-payments") {
			// confirm .message.order.payments[0].tags
			// confirm.message.order.fulfillments = [
			// 	{
			// 		id:"F1",
			// 		type:"SUBSCRIPTION",
			// 		stops: [
			// 			{
			// 				type:"start",
			// 				duration: "P8W",
			// 				schedule: {
			// 					frequency: "P1W",
			// 				},
			// 				time: {
			// 					label: "confirmed",
			// 					range: {
			// 						end: "2024-06-04T10:30:00.000Z",
			// 						start: "2024-04-04T09:30:00.000Z",
			// 					},
			// 				},
			// 			},
			// 		],
			// 		"tags": [
      //                   {
      //                       "descriptor": {
      //                           "code": "INFO"
      //                       },
      //                       "list": [
      //                           {
      //                               "descriptor": {
      //                                   "code": "PARENT_ID"
      //                               },
      //                               "value": "F1"
      //                           }
      //                       ]
      //                   }
      //               ]
			// 	},
			// ];
			confirm.message.order.fulfillments=[{
				...fulfillments[0],
				stops:[
					{
						duration:"P8W",
						schedule:{
							frequency:"P1W"
						},
						...fulfillments[0].stops[0]
					}
				]
			}]
			delete confirm.message.order.fulfillments[0].stops[0].instructions
			delete confirm.message.order.fulfillments[0].stops[0].location
			delete confirm.message.order.fulfillments[0].stops[0].contact
			delete confirm.message.order.fulfillments[0].stops[0].time.days
			delete confirm.message.order.items[0].tags;
			delete confirm.message.order.items[0].price;
			delete confirm.message.order.items[0].title;
			delete confirm.message.order.payments[0].params.transaction_id;
			delete confirm.message.order.payments[0].url
			confirm.message.order.payments[0].tags.push(
				{"descriptor": {
							"code": "INFO"
					},
					"display": false,
					"list": [
							{
									"descriptor": {
											"code": "TOTAL_PAYMENTS"
									},
									"value": "8"
							}
					]}
			)
		}
		console.log('paymenttasg',confirm.message.order.payments[0].tags[0])
		console.log("scenariooooooooooooooo", JSON.stringify(confirm));
		await send_response(
			res,
			next,
			confirm,
			transaction_id,
			"confirm",
			(scenario = scenario)
		);
	} catch (error) {
		next(error);
	}
};
