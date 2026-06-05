import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface ISlicingBatch extends Document {
  _id: Types.ObjectId;
  slicingDate: Date;
  slicer: string;
  packer: string;
  totalHeads: number;
  totalKilos: number;
  totalStdPcs: number;
  totalActualPcs: number;
  totalPacks: number;
  totalButal: number;
  totalVariance: number;
  totalInputCost: number;
  totalOutputValue: number;
  totalVarianceValue: number;
  laborCost: number;
  packingCost: number;
  otherCost: number;
  totalAdditionalCost: number;
  totalRecoveryProfit: number;
  averageRecoveryRate: number;
  averageYieldRate: number;
  createdBy?: Types.ObjectId;
  isVoided: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SlicingBatchSchema = new Schema<ISlicingBatch>(
  {
    slicingDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    slicer: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    packer: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    totalHeads: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalKilos: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalStdPcs: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalActualPcs: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalPacks: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalButal: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalVariance: {
      type: Number,
      default: 0,
    },
    totalInputCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalOutputValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalVarianceValue: {
      type: Number,
      default: 0,
    },
    laborCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    packingCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    otherCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAdditionalCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalRecoveryProfit: {
      type: Number,
      default: 0,
    },
    averageRecoveryRate: {
      type: Number,
      default: 0,
    },
    averageYieldRate: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    isVoided: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

SlicingBatchSchema.index({ slicingDate: -1 });
SlicingBatchSchema.index({ isVoided: 1 });

const SlicingBatchModel: Model<ISlicingBatch> =
  mongoose.models.SlicingBatch || mongoose.model("SlicingBatch", SlicingBatchSchema);

export default SlicingBatchModel;
