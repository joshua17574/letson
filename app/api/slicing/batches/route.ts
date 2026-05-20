import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import dbConnect from "@/lib/mongodb";
import ProductModel from "@/models/Product";
import SlicingBatchModel from "@/models/SlicingBatch";
import SlicingItemModel from "@/models/SlicingItem";
import SlicingStandardModel from "@/models/SlicingStandard";

function toNumber(value: any) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

export async function POST(req: NextRequest) {
  const session = await mongoose.startSession();

  try {
    await dbConnect();

    // Important for populate
    ProductModel;

    const body = await req.json();

    const {
      slicingDate,
      slicer,
      packer,
      items = [],
    } = body;

    if (!slicer || !packer) {
      return NextResponse.json(
        {
          success: false,
          message: "Slicer and packer are required.",
        },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "At least one slicing item is required.",
        },
        { status: 400 }
      );
    }

    const standardIds = items.map((item: any) => item.standardId);

    const standards = await SlicingStandardModel.find({
      _id: { $in: standardIds },
      isActive: true,
    })
      .populate("wholeChickenId", "name")
      .populate("productId", "name")
      .lean();

    const standardMap = new Map(
      standards.map((standard: any) => [standard._id.toString(), standard])
    );

    const preparedItems = items.map((item: any) => {
      const standard = standardMap.get(item.standardId);

      if (!standard) {
        throw new Error("Selected slicing standard was not found.");
      }

      const bags = toNumber(item.bags);
      const heads = toNumber(item.heads);
      const kilos = toNumber(item.kilos);
      const actualSlicedPcs = toNumber(item.actualSlicedPcs);

      const standardSlice = toNumber(standard.standardSlice);
      const standardPacking = toNumber(standard.standardPacking);

      const totalStdPcs = heads * standardSlice;

      const actualPacks =
        standardPacking > 0
          ? Math.floor(actualSlicedPcs / standardPacking)
          : 0;

      const butal =
        standardPacking > 0
          ? actualSlicedPcs % standardPacking
          : actualSlicedPcs;

      const variance = actualSlicedPcs - totalStdPcs;

      return {
        standardId: standard._id,

        mainProductId: standard.wholeChickenId._id,
        slicedProductId: standard.productId._id,

        mainProductName: standard.wholeChickenId.name,
        slicedProductName: standard.productId.name,

        bags,
        heads,
        kilos,

        standardSlice,
        standardPacking,

        totalStdPcs,
        actualSlicedPcs,
        actualPacks,
        butal,
        variance,
      };
    });

    const totals = preparedItems.reduce(
      (sum, item) => {
        sum.totalHeads += item.heads;
        sum.totalKilos += item.kilos;
        sum.totalStdPcs += item.totalStdPcs;
        sum.totalActualPcs += item.actualSlicedPcs;
        sum.totalPacks += item.actualPacks;
        sum.totalVariance += item.variance;
        return sum;
      },
      {
        totalHeads: 0,
        totalKilos: 0,
        totalStdPcs: 0,
        totalActualPcs: 0,
        totalPacks: 0,
        totalVariance: 0,
      }
    );

    let savedBatch: any;
    let savedItems: any[] = [];

    await session.withTransaction(async () => {
      const [batch] = await SlicingBatchModel.create(
        [
          {
            slicingDate: slicingDate ? new Date(slicingDate) : new Date(),
            slicer,
            packer,
            ...totals,
          },
        ],
        { session }
      );

      savedBatch = batch;

      savedItems = await SlicingItemModel.insertMany(
        preparedItems.map((item) => ({
          ...item,
          batchId: batch._id,
        })),
        { session }
      );
    });

    return NextResponse.json(
      {
        success: true,
        message: "Slicing batch saved successfully.",
        data: {
          batch: savedBatch,
          items: savedItems,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("CREATE SLICING BATCH ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to save slicing batch.",
      },
      { status: 500 }
    );
  } finally {
    session.endSession();
  }
}


export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);

    const page = Number(searchParams.get("page") || 1);
    const limit = Number(searchParams.get("limit") || 10);
    const search = searchParams.get("search") || "";

    const skip = (page - 1) * limit;

    const filter: any = {
      isVoided: false,
    };

    if (search) {
      filter.$or = [
        { slicer: { $regex: search, $options: "i" } },
        { packer: { $regex: search, $options: "i" } },
      ];
    }

    const [records, total] = await Promise.all([
      SlicingBatchModel.find(filter)
        .sort({ slicingDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      SlicingBatchModel.countDocuments(filter),
    ]);

    return NextResponse.json({
      success: true,
      data: records.map((batch: any) => ({
        _id: batch._id.toString(),
        slicingDate: batch.slicingDate,
        slicer: batch.slicer,
        packer: batch.packer,
        totalHeads: batch.totalHeads,
        totalKilos: batch.totalKilos,
        totalStdPcs: batch.totalStdPcs,
        totalActualPcs: batch.totalActualPcs,
        totalPacks: batch.totalPacks,
        totalVariance: batch.totalVariance,
        isVoided: batch.isVoided,
        createdAt: batch.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("GET SLICING HISTORY ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to load slicing history.",
      },
      { status: 500 }
    );
  }
}