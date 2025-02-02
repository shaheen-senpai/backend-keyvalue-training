import EmployeeService from "../service/employee.service";
import express from "express";
import { Request, Response, NextFunction } from "express";
import { RequestWithUser } from "../utils/requestWithUser";
import HttpException from "../execptions/http.exceptions";
import { plainToInstance } from "class-transformer";
import { CreateEmployeeDto, UpdateEmployeeDto, updateEmployeeRelationshipDto } from "../dto/employee.dto";
import { validate } from "class-validator";
import Role from "../utils/role.enum";
import authorize from "../middleware/auth.middleware";
import extractValidationErrors from "../utils/extractValidationErrors";

// API Calls
class EmployeeController {
	public router: express.Router;

	constructor(private employeeService: EmployeeService) {
		this.router = express.Router();

		this.router.get("/me", authorize, this.getUserParams);
		this.router.get("/:id", authorize, this.getEmployeeById);
		this.router.get("/", authorize, this.getAllEmployees);
		this.router.post("/login", this.loginEmployee); // No authorization required here as it is a login route
		this.router.post("/", authorize, this.createEmployee);
		this.router.put("/:id", authorize, this.updateEmployee);
		this.router.patch("/password", authorize, this.updateEmployeePassword);
		this.router.patch("/:id", authorize, this.updateEmployeeRelationship);
		this.router.delete("/:id", authorize, this.deleteEmployee);
	}

	public getUserParams = (req: RequestWithUser, res: Response, next: NextFunction) => {
		try {
			const { name, email, role, id } = req;
			res.status(200).json({ name, email, role, id });
		} catch (error) {
			res.status(500).json({ message: "An error occurred while fetching user details." });
		}
	};

	public loginEmployee = async (req: Request, res: Response, next: NextFunction) => {
		const { email, password } = req.body;
		try {
			const token = await this.employeeService.login(email, password);
			if (!token) {
				throw new HttpException(401, "Unauthorized", ["Invalid email or password"]);
			}
			res.status(200).json(token);
		} catch (err) {
			next(err);
		}
	};

	public getAllEmployees = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const employees = await this.employeeService.getAllEmployees();
			if (!employees) {
				throw new HttpException(404, "Records not found", ["No employees found in the database"]);
			}
			res.status(200).send(employees);
		} catch (err) {
			next(err);
		}
	};

	public getEmployeeById = async (req: Request, res: Response, next: NextFunction) => {
		const { id } = req.params;
		try {
			const employee = await this.employeeService.getEmployeeById(Number(id));
			if (!employee) {
				throw new HttpException(404, "Record not found", [
					"Employee not found in the database for the given id",
				]);
			}
			res.status(200).send(employee);
		} catch (err) {
			next(err);
		}
	};

	public createEmployee = async (req: RequestWithUser, res: Response, next: NextFunction) => {
		try {
			const role = req.role;
			if (!(role === Role.HR || role === Role.ADMIN)) {
				throw new HttpException(403, "Forbidden", ["You are not authorized to create an employee"]);
			}

			const employeeDto = plainToInstance(CreateEmployeeDto, req.body);
			const errors = await validate(employeeDto);
			if (errors.length) {
				// console.log(errors);
				const error_list = extractValidationErrors(errors);
				throw new HttpException(400, "Validation failed", error_list);
			}
			if (!employeeDto.department) {
				throw new HttpException(400, "Bad request", ["Department is required"]);
			}
			const savedEmployee = await this.employeeService.createEmployee(employeeDto);
			if (!savedEmployee) {
				throw new HttpException(500, "Internal Server Error", ["Employee not created"]);
			}
			res.status(201).send(savedEmployee);
		} catch (err) {
			if (err.code === "23505") {
				const error = new HttpException(400, "Bad request", ["Email already exists"]);
				next(error);
			}
			next(err);
		}
	};

	public deleteEmployee = async (req: RequestWithUser, res: Response, next: NextFunction) => {
		const { id } = req.params;
		try {
			const role = req.role;
			if (!(role === Role.HR || role === Role.ADMIN)) {
				throw new HttpException(403, "Forbidden", ["You are not authorized to delete an employee"]);
			}
			await this.employeeService.deleteEmployee(Number(id));
			res.status(200).json({ message: `Employee with id: ${id} deleted successfully` });
		} catch (err) {
			console.log(err);
			if (err.status !== 403) {
				const error = new HttpException(404, "Record not found", [
					"Employee not found in the database for the given id",
				]);
				next(error);
			} else {
				next(err);
			}
		}
	};

	public updateEmployee = async (req: Request, res: Response, next: NextFunction) => {
		const { id } = req.params;
		try {
			const updateEmployeeDto = plainToInstance(UpdateEmployeeDto, req.body);
			const errors = await validate(updateEmployeeDto);
			if (errors.length) {
				const error_list = extractValidationErrors(errors);
				throw new HttpException(400, "Validation failed", error_list);
			}

			const updatedEmployee = await this.employeeService.updateEmployee(Number(id), updateEmployeeDto);
			if (!updatedEmployee) {
				throw new HttpException(404, "Record not found", [
					"Employee not found in the database for the given id",
				]);
			}
			res.status(200).send(updatedEmployee);
		} catch (err) {
			next(err);
		}
	};

	public updateEmployeeRelationship = async (req: Request, res: Response, next: NextFunction) => {
		const { id } = req.params;
		try {
			const updateEmployee = plainToInstance(updateEmployeeRelationshipDto, req.body);
			const updatedEmployee = await this.employeeService.updateEmployeeRelationship(Number(id), updateEmployee);
			if (!updatedEmployee) {
				throw new HttpException(404, "Record not found", [
					"Employee not found in the database for the given id",
				]);
			}
			// remove password from the response
			delete updatedEmployee.password;
			res.status(200).send(updatedEmployee);
		} catch (err) {
			next(err);
		}
	};

	public updateEmployeePassword = async (req: RequestWithUser, res: Response, next: NextFunction) => { 
		const { id } = req;
		const { passwordOld, passwordNew } = req.body;
		try {
			const updatedEmployee = await this.employeeService.updateEmployeePassword(id, passwordOld, passwordNew);
			if (!updatedEmployee) {
				throw new HttpException(404, "Record not found", [
					"Employee not found or password is incorrect",
				]);
			}
			res.status(200).json({ message: "Password updated successfully" });
		} catch (err) {
			next(err);
		}
	};
}

export default EmployeeController;
