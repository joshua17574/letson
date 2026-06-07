import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId, Types } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/require-auth";
import { setDateRangeFilter } from "@/lib/date-range";
import BodegaProductModel from "@/models/BodegaProduct";
import SlicingBatchModel from "@/models/SlicingBatch";
import SlicingItemModel from "@/models/SlicingItem";

function cleanString(value: string | null | undefined) {
  return String(value || "").trim();
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

type ReportBatch = {
  _id: Types.ObjectId;
  slicingDate?: Date | string | null;
  slicer?: string | null;
  packer?: string | null;
};

type ReportItem = {
  _id: Types.ObjectId;
  batchId?: Types.ObjectId | string | null;
  mainProductId?: Types.ObjectId | string | null;
  slicedProductId?: Types.ObjectId | string | null;
  mainProductName?: string | null;
  slicedProductName?: string | null;
  heads?: number | null;
  kilos?: number | null;
  standardSlice?: number | null;
  standardPacking?: number | null;
  totalStdPcs?: number | null;
  actualSlicedPcs?: number | null;
  actualPacks?: number | null;
  butal?: number | null;
  variance?: number | null;
};

type ReportProduct = {
  _id: Types.ObjectId;
  name?: string | null;
  buyingPrice?: number | null;
  sellingPrice?: number | null;
};

function toObjectIdString(value: unknown) {
  if (!value) return "";
  return String(value);
}

function hasProfitPermission(session: any) {
  const user = session?.user || {};
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  const legacyRole = String(user.role || "").toUpperCase();
  const roleName = String(user.roleName || "").toUpperCase();

  return (
    legacyRole === "ADMIN" ||
    roleName === "ADMIN" ||
    permissions.includes("reports.profit")
  );
}

function getBatchDate(batch: ReportBatch | undefined) {
  if (!batch?.slicingDate) return "";
  return new Date(batch.slicingDate).toISOString();
}

function getProductPrice(product: ReportProduct | undefined, field: "buyingPrice" | "sellingPrice") {
  return numberValue(product?.[field]);
}

export async function GET(req: NextRequest) {
  const { response, session } = await requireApiAuth();
  if (response) return response;

  if (!hasProfitPermission(session)) {
    return NextResponse.json(
      { success: false, message: "You do not have permission to view profit reports." },
      { status: 403 }
    );
  }

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const dateFrom = cleanString(searchParams.get("dateFrom"));
  const dateTo = cleanString(searchParams.get("dateTo"));
  const mainProductId = cleanString(searchParams.get("mainProductId"));
  const slicedProductId = cleanString(searchParams.get("slicedProductId"));
  const search = cleanString(searchParams.get("search"));
  const limitParam = Math.trunc(numberValue(searchParams.get("limit")));
  const limit = Math.min(Math.max(limitParam || 5000, 1), 20000);

  const batchFilter: Record<string, any> = { isVoided: false };

  setDateRangeFilter(batchFilter, "slicingDate", dateFrom, dateTo);

  const batches = (await SlicingBatchModel.find(batchFilter)
    .select("_id slicingDate slicer packer")
    .lean()) as ReportBatch[];

  const batchIds = batches.map((batch) => batch._id);
  const batchById = new Map(
    batches.map((batch) => [String(batch._id), batch])
  );

  const itemFilter: Record<string, any> = {
    batchId: { $in: batchIds },
  };

  if (mainProductId && mainProductId !== "ALL" && isValidObjectId(mainProductId)) {
    itemFilter.mainProductId = mainProductId;
  }

  if (slicedProductId && slicedProductId !== "ALL" && isValidObjectId(slicedProductId)) {
    itemFilter.slicedProductId = slicedProductId;
  }

  if (search) {
    itemFilter.$or = [
      { mainProductName: { $regex: search, $options: "i" } },
      { slicedProductName: { $regex: search, $options: "i" } },
    ];
  }

  const items = (await SlicingItemModel.find(itemFilter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()) as ReportItem[];

  const allProductIds = Array.from(
    new Set(
      items
        .flatMap((item) => [
          toObjectIdString(item.mainProductId),
          toObjectIdString(item.slicedProductId),
        ])
        .filter(Boolean)
    )
  );

  const products = (await BodegaProductModel.find({ _id: { $in: allProductIds } })
    .select("_id name buyingPrice sellingPrice")
    .lean()) as ReportProduct[];

  const productById = new Map(products.map((product) => [String(product._id), product]));

  const mainProductsMap = new Map<string, { _id: string; name: string }>();
  const slicedProductsMap = new Map<string, { _id: string; name: string }>();

  const rows = items.map((item) => {
    const batch = batchById.get(String(item.batchId));
    const mainProduct = productById.get(String(item.mainProductId));
    const slicedProduct = productById.get(String(item.slicedProductId));

    const mainProductName = String(mainProduct?.name || item.mainProductName || "");
    const slicedProductName = String(slicedProduct?.name || item.slicedProductName || "");
    const mainProductIdValue = String(item.mainProductId || "");
    const slicedProductIdValue = String(item.slicedProductId || "");

    if (mainProductIdValue) {
      mainProductsMap.set(mainProductIdValue, {
        _id: mainProductIdValue,
        name: mainProductName,
      });
    }

    if (slicedProductIdValue) {
      slicedProductsMap.set(slicedProductIdValue, {
        _id: slicedProductIdValue,
        name: slicedProductName,
      });
    }

    const kilos = numberValue(item.kilos);
    const heads = numberValue(item.heads);
    const standardPacking = Math.trunc(numberValue(item.standardPacking));
    const standardSlice = Math.trunc(numberValue(item.standardSlice));
    const standardPcs = numberValue(item.totalStdPcs) || heads * standardSlice;
    const actualPcs = Math.trunc(numberValue(item.actualSlicedPcs));
    const actualPacks = Math.trunc(numberValue(item.actualPacks));
    const loosePcs = Math.trunc(numberValue(item.butal));
    const variance = numberValue(item.variance);

    const deliveryPrice = getProductPrice(mainProduct, "buyingPrice");
    const pricePerPack = getProductPrice(slicedProduct, "sellingPrice");
    const pricePerPcs = standardPacking > 0 ? roundMoney(pricePerPack / standardPacking) : 0;

    // Sliced product sellingPrice is treated as PRICE PER PACK.
    // Example: C10 standardPacking = 50 pcs and sellingPrice = 377.
    // Price per pcs = 377 / 50 = 7.54.
    // Total amount/gross = full packs x price per pack + loose pcs x price per pcs.
    const capitalBaseQty = kilos > 0 ? kilos : heads;
    const capital = roundMoney(capitalBaseQty * deliveryPrice);
    const gross = roundMoney(actualPacks * pricePerPack + loosePcs * pricePerPcs);
    const profit = roundMoney(gross - capital);

    return {
      _id: String(item._id),
      batchId: String(item.batchId || ""),
      date: getBatchDate(batch),
      mainProductId: mainProductIdValue,
      mainProductName,
      slicedProductId: slicedProductIdValue,
      slicedProductName,
      heads,
      kilos,
      deliveryPrice,
      standardSlice,
      standardPacking,
      standardPcs,
      actualPcs,
      actualPacks,
      loosePcs,
      variance,
      pricePerPcs,
      pricePerPack,
      capital,
      gross,
      profit,
      slicer: String(batch?.slicer || ""),
      packer: String(batch?.packer || ""),
    };
  });

  const summary = rows.reduce(
    (total, row) => ({
      totalRows: total.totalRows + 1,
      totalHeads: total.totalHeads + row.heads,
      totalKilos: total.totalKilos + row.kilos,
      totalStandardPcs: total.totalStandardPcs + row.standardPcs,
      totalActualPcs: total.totalActualPcs + row.actualPcs,
      totalPacks: total.totalPacks + row.actualPacks,
      totalLoosePcs: total.totalLoosePcs + row.loosePcs,
      totalCapital: roundMoney(total.totalCapital + row.capital),
      totalGross: roundMoney(total.totalGross + row.gross),
      totalProfit: roundMoney(total.totalProfit + row.profit),
    }),
    {
      totalRows: 0,
      totalHeads: 0,
      totalKilos: 0,
      totalStandardPcs: 0,
      totalActualPcs: 0,
      totalPacks: 0,
      totalLoosePcs: 0,
      totalCapital: 0,
      totalGross: 0,
      totalProfit: 0,
    }
  );

  return NextResponse.json({
    success: true,
    data: rows,
    summary,
    filters: {
      mainProducts: Array.from(mainProductsMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
      slicedProducts: Array.from(slicedProductsMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    },
  });
}
