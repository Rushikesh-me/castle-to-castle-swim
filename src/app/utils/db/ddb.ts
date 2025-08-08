import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const ddbClient = new DynamoDBClient({
	region: process.env.DYNAMODB_REGION || "eu-west-1",
	credentials: {
		accessKeyId: process.env.APP_AWS_ACCESS_KEY || "",
		secretAccessKey: process.env.APP_AWS_SECRET_KEY || "",
	},
});

const marshallOptions = {
	convertEmptyValues: false,
	removeUndefinedValues: false,
	convertClassInstanceToMap: false,
};

const unmarshallOptions = {
	wrapNumbers: false,
};

const translateConfig = { marshallOptions, unmarshallOptions };

const ddb = DynamoDBDocumentClient.from(ddbClient, translateConfig);

export default ddb;
