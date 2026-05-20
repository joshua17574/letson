// app/api/slicing/route.ts
import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/require-auth";
import { cleanNumber, cleanString, getPagination } from "@/lib/crud-utils";
import BodegaProductModel from "@/models/BodegaProduct";
import BodegaStockTransactionModel from "@/models/BodegaStockTransaction";
import SlicingBatchModel from "@/models/SlicingBatch";
import SlicingItemModel from "@/models/SlicingItem";
import StandardPackingModel from "@/models/StandardPacking";

type SlicingItemInput = {
  standardId?: string;
  standardPackingId?: string;
  slicingStandardId?: string;

  bags?: number;
  heads?: number;
  qtyToSlice?: number;
  kilos?: number;
  actualSlicedPcs?: number;
};

function serializeSlicingItem(item: any) {
  return {
    _id: item._id.toString(),
    batchId: item.batchId?._id?.toString?.() || item.batchId?.toString?.(),
    mainProductName: item.mainProductName,
    slicedProductName: item.slicedProductName,
    qtyToSlice: item.heads || 0,
    actualSlicedPcs: item.actualSlicedPcs || 0,
    standardPacking: item.standardPacking || 0,
    actualPacks: item.actualPacks || 0,
    variance: item.variance || 0,
    kilos: item.kilos || 0,
    bags: item.bags || 0,
    slicingDate: item.batchId?.slicingDate
      ? new Date(item.batchId.slicingDate).toISOString()
      : undefined,
    slicer: item.batchId?.slicer || "",
    packer: item.batchId?.packer || "",
  };
}

export async function GET(req: NextRequest) {
  const { response } = await requireApiAuth();

  if (response) return response;

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = getPagination(searchParams);

  const slicedProductId = cleanString(searchParams.get("slicedProductId"));
  const dateFrom = cleanString(searchParams.get("dateFrom"));
  const dateTo = cleanString(searchParams.get("dateTo"));

  const batchFilter: Record<string, any> = {
    isVoided: false,
  };

  if (dateFrom || dateTo) {
    batchFilter.slicingDate = {};

    if (dateFrom) {
      batchFilter.slicingDate.$gte = new Date(`${dateFrom}T00:00:00.000Z`);
    }

    if (dateTo) {
      batchFilter.slicingDate.$lte = new Date(`${dateTo}T23:59:59.999Z`);
    }
  }

  const batches = await SlicingBatchModel.find(batchFilter).select("_id").lean();
  const batchIds = batches.map((item) => item._id);

  const itemFilter: Record<string, any> = {
    batchId: {
      $in: batchIds,
    },
  };

  if (
    slicedProductId &&
    slicedProductId !== "ALL" &&
    isValidObjectId(slicedProductId)
  ) {
    itemFilter.slicedProductId = slicedProductId;
  }

  const [items, total] = await Promise.all([
    SlicingItemModel.find(itemFilter)
      .populate("batchId", "slicingDate slicer packer")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    SlicingItemModel.countDocuments(itemFilter),
  ]);

  return NextResponse.json({
    success: true,
    data: items.map(serializeSlicingItem),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  });
}

export async function POST(req: NextRequest) {
  const { response, session } = await requireApiAuth();

  if (response) return response;

  await dbConnect();

  void BodegaProductModel;

  const body = await req.json();

  const slicingDate = cleanString(body.slicingDate);
  const slicer = cleanString(body.slicer);
  const packer = cleanString(body.packer);

  const rawItems: SlicingItemInput[] = Array.isArray(body.items)
    ? body.items
    : Array.isArray(body.records)
      ? body.records
      : Array.isArray(body.slicingItems)
        ? body.slicingItems
        : [];

  if (!slicingDate) {
    return NextResponse.json(
      {
        success: false,
        message: "Slicing date is required.",
      },
      { status: 400 }
    );
  }

  if (!slicer) {
    return NextResponse.json(
      {
        success: false,
        message: "Slicer name is required.",
      },
      { status: 400 }
    );
  }

  if (!packer) {
    return NextResponse.json(
      {
        success: false,
        message: "Packer name is required.",
      },
      { status: 400 }
    );
  }

  if (rawItems.length === 0) {
    return NextResponse.json(
      {
        success: false,
        message: "At least one slicing item is required.",
      },
      { status: 400 }
    );
  }

  let totalHeads = 0;
  let totalKilos = 0;
  let totalStdPcs = 0;
  let totalActualPcs = 0;
  let totalPacks = 0;
  let totalVariance = 0;

  const preparedItems = [];

  for (const item of rawItems) {
    const standardId = cleanString(
      item.standardId || item.standardPackingId || item.slicingStandardId || ""
    );

    if (!standardId || !isValidObjectId(standardId)) {
      return NextResponse.json(
        {
          success: false,
          message: "Selected standard is invalid.",
        },
        { status: 400 }
      );
    }

    const standard = await StandardPackingModel.findOne({
      _id: standardId,
      isActive: true,
    });

    if (!standard) {
      return NextResponse.json(
        {
          success: false,
          message: "Selected standard was not found.",
        },
        { status: 404 }
      );
    }

    const [mainProduct, slicedProduct] = await Promise.all([
      BodegaProductModel.findOne({
        _id: standard.wholeChickenId,
        isActive: true,
      }),

      BodegaProductModel.findOne({
        _id: standard.productId,
        isActive: true,
      }),
    ]);

    if (!mainProduct || !slicedProduct) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Bodega product connected to selected standard was not found.",
        },
        { status: 404 }
      );
    }

    const bags = cleanNumber(item.bags);
    const heads = cleanNumber(item.heads || item.qtyToSlice);
    const kilos = cleanNumber(item.kilos);
    const actualSlicedPcs = cleanNumber(item.actualSlicedPcs);

    if (heads <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Heads must be greater than zero.",
        },
        { status: 400 }
      );
    }

    if (actualSlicedPcs <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Actual sliced PCS must be greater than zero.",
        },
        { status: 400 }
      );
    }

    const standardSlice = Number(standard.standardSlice || 0);
    const standardPacking = Number(standard.standardPacking || 0);

    if (standardSlice <= 0 || standardPacking <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Invalid standard values for ${mainProduct.name} → ${slicedProduct.name}.`,
        },
        { status: 400 }
      );
    }

    const totalStd = heads * standardSlice;
    const actualPacks = Math.floor(actualSlicedPcs / standardPacking);
    const butal = actualSlicedPcs % standardPacking;
    const variance = actualSlicedPcs - totalStd;

    totalHeads += heads;
    totalKilos += kilos;
    totalStdPcs += totalStd;
    totalActualPcs += actualSlicedPcs;
    totalPacks += actualPacks;
    totalVariance += variance;

    preparedItems.push({
      standardId: standard._id,

      mainProduct,
      slicedProduct,

      mainProductId: mainProduct._id,
      slicedProductId: slicedProduct._id,

      mainProductName: mainProduct.name,
      slicedProductName: slicedProduct.name,

      bags,
      heads,
      kilos,

      standardSlice,
      standardPacking,

      totalStdPcs: totalStd,
      actualSlicedPcs,
      actualPacks,
      butal,
      variance,
    });
  }

  const batch = await SlicingBatchModel.create({
    slicingDate: new Date(slicingDate),
    slicer,
    packer,
    totalHeads,
    totalKilos,
    totalStdPcs,
    totalActualPcs,
    totalPacks,
    totalVariance,
    createdBy: session?.user?.id,
  });

  const slicingItemsToInsert = [];
  const bodegaStockTransactions = [];

  for (const item of preparedItems) {
    const mainProduct = item.mainProduct;
    const slicedProduct = item.slicedProduct;

    slicingItemsToInsert.push({
      batchId: batch._id,
      standardId: item.standardId,

      mainProductId: item.mainProductId,
      slicedProductId: item.slicedProductId,

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
    });

    if (item.heads > 0) {
      const previousStock = Number(mainProduct.stockQty || 0);
      mainProduct.stockQty = Math.max(previousStock - item.heads, 0);

      bodegaStockTransactions.push({
        bodegaProductId: mainProduct._id,
        type: "STOCK_OUT",
        quantity: item.heads,
        previousStock,
        newStock: mainProduct.stockQty,
        remarks: `SLICING OUT ${batch._id.toString()}`,
        referenceType: "SLICING_BATCH",
        referenceId: batch._id,
        createdBy: session?.user?.id,
      });
    }

    if (item.actualSlicedPcs > 0) {
      const previousStock = Number(slicedProduct.stockQty || 0);
      slicedProduct.stockQty = previousStock + item.actualSlicedPcs;

      bodegaStockTransactions.push({
        bodegaProductId: slicedProduct._id,
        type: "STOCK_IN",
        quantity: item.actualSlicedPcs,
        previousStock,
        newStock: slicedProduct.stockQty,
        remarks: `SLICING IN ${batch._id.toString()}`,
        referenceType: "SLICING_BATCH",
        referenceId: batch._id,
        createdBy: session?.user?.id,
      });
    }

    await mainProduct.save();
    await slicedProduct.save();
  }

  await SlicingItemModel.insertMany(slicingItemsToInsert);

  if (bodegaStockTransactions.length > 0) {
    await BodegaStockTransactionModel.insertMany(bodegaStockTransactions);
  }

  return NextResponse.json(
    {
      success: true,
      message: "Slicing records saved successfully.",
      data: {
        _id: batch._id.toString(),
      },
    },
    { status: 201 }
  );
}