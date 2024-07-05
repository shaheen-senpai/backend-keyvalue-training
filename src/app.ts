import express from "express";
import loggerMiddleware from "./middleware/logger.middleware";
import employeeRouter from "./routes/employee.routes";
import AppdataSource from "./db/data-source";
import errorMiddleware from "./middleware/error.middleware";

const server = express();
server.use(loggerMiddleware);
server.use(express.json());
server.use("/employee", employeeRouter);

server.get("/", (req, res) => {
	res.send("Hello World");
});

server.use(errorMiddleware);

(async () => {
	try {
		await AppdataSource.initialize();
	} catch (e) {
		console.log("Failed", e);
		process.exit(1);
	}
	server.listen(3000, () => {
		console.log("server listening to 3000");
	});
})();
