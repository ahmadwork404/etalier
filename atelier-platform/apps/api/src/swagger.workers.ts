import type {Request,Response,NextFunction} from "express";
export default {serve:(_request:Request,_response:Response,next:NextFunction)=>next(),setup:()=> (_request:Request,response:Response)=>response.redirect("/api/v1/openapi.json")};
