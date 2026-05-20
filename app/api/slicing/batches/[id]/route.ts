import { NextRequest, NextResponse } from "next/server";

import dbConnect from "@/lib/mongodb";
import SlicingBatchModel from "@/models/SlicingBatch";
import SlicingItemModel from "@/models/SlicingItem";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    const { id } = await context.params;

    const batch = await SlicingBatchModel.findById(id).lean();

    if (!batch) {
      return NextResponse.json(
        {
          success: false,
          message: "Slicing batch not found.",
        },
        { status: 404 }
      );
    }

    const items = await SlicingItemModel.find({ batchId: id })
      .sort({ createdAt: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: {
        batch: {
          ...batch,
          _id: batch._id.toString(),
        },
        items: items.map((item: any) => ({
          _id: item._id.toString(),
          batchId: item.batchId.toString(),
          standardId: item.standardId.toString(),

          mainProductId: item.mainProductId.toString(),
          slicedProductId: item.slicedProductId.toString(),

          mainProductName: item.mainProductName,
          slicedProductName: item.slicedProductName,

          bags: item.bags,
          heads: item.heads,
          kilos: item.kilos,

          standardSlice: item.standardSlice,
          standardPacking: item.standardPacking,

          totalStdPcs: item.totalStdPcs,
          actualSlicedPcs: item.actualSlicedPcs,
          actualPacks: item.actualPacks,
          butal: item.butal,
          variance: item.variance,
        })),
      },
    });
  } catch (error: any) {
    console.error("GET SLICING BATCH DETAIL ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to load slicing batch detail.",
      },
      { status: 500 }
    );
  }
}