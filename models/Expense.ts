// models/Expense.ts
import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type ExpenseCategory = "GROCERY" | "BODEGA";

export type ExpenseType =
  | "DELIVERY_EXPENSES"
  | "CLEANING_SUPPLIES"
  | "TRANSPORTATION_EXPENSES"
  | "MARINATE_EXPENSES"
  | "OFFICE_SUPPLIES"
  | "REPAIR_AND_MAINTENANCE"
  | "SALARIES"
  | "INCENTIVES_AND_ALLOWANCES"
  | "OTHERS";

export interface IExpense extends Document {
  _id: Types.ObjectId;
  name: string;
  expenseCategory: ExpenseCategory;
  type: ExpenseType;
  expenseDate: Date;
  amount: number;
  remarks?: string;
  createdBy?: Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const expenseCategoryValues: ExpenseCategory[] = ["GROCERY", "BODEGA"];

const expenseTypeValues: ExpenseType[] = [
  "DELIVERY_EXPENSES",
  "CLEANING_SUPPLIES",
  "TRANSPORTATION_EXPENSES",
  "MARINATE_EXPENSES",
  "OFFICE_SUPPLIES",
  "REPAIR_AND_MAINTENANCE",
  "SALARIES",
  "INCENTIVES_AND_ALLOWANCES",
  "OTHERS",
];

const ExpenseSchema = new Schema<IExpense>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    expenseCategory: {
      type: String,
      enum: expenseCategoryValues,
      default: "BODEGA",
      required: true,
    },

    type: {
      type: String,
      enum: expenseTypeValues,
      default: "OTHERS",
      required: true,
    },

    expenseDate: {
      type: Date,
      required: true,
      default: Date.now,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    remarks: {
      type: String,
      default: "",
      trim: true,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

ExpenseSchema.index({ name: 1 });
ExpenseSchema.index({ expenseCategory: 1 });
ExpenseSchema.index({ type: 1 });
ExpenseSchema.index({ expenseDate: -1 });
ExpenseSchema.index({ isActive: 1 });

const ExpenseModel: Model<IExpense> =
  mongoose.models.Expense || mongoose.model<IExpense>("Expense", ExpenseSchema);

export default ExpenseModel;
