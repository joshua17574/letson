import { NextResponse } from "next/server";
import { Types } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import { idToString, numberValue, wholeNumber } from "@/lib/customer-delivery-utils";
import BodegaProductModel from "@/models/BodegaProduct";
import CategoryModel from "@/models/Category";
import CustomerModel from "@/models/Customer";
import OutletModel from "@/models/Outlet";
import ProductModel from "@/models/Product";
import StandardPackingModel from "@/models/StandardPacking";

function getCategoryName(category: unknown) {
  if (!category || typeof category === "string" || category instanceof Types.ObjectId) {
    return "";
  }

  return (category as { name?: string }).name || "";
}

function getPackBreakdown(stockQtyValue: unknown, packSizeValue: unknown) {
  const stockPcs = wholeNumber(stockQtyValue);
  const packSize = wholeNumber(packSizeValue);

  if (packSize <= 0) {
    return {
      stockPcs,
      stockPacks: 0,
      stockLoosePcs: stockPcs,
    };
  }

  const stockPacks = Math.floor(stockPcs / packSize);
  const stockLoosePcs = stockPcs - stockPacks * packSize;

  return {
    stockPcs,
    stockPacks,
    stockLoosePcs,
  };
}

export async function GET() {
  const { response } = await requirePermission("customer-deliveries.view");
  if (response) return response;

  await dbConnect();

  void CategoryModel;

  const [customers, outlets, bodegaProducts, groceryProducts] = await Promise.all([
    CustomerModel.find({
      isActive: true,
    })
      .select("name phone address type")
      .sort({ name: 1 })
      .lean(),
    OutletModel.find({ isActive: true })
      .select("name code address managerName contactNumber")
      .sort({ name: 1 })
      .lean(),
    BodegaProductModel.find({ isActive: true })
      .populate("categoryId", "name")
      .sort({ name: 1 })
      .lean(),
    ProductModel.find({ isActive: true })
      .populate("categoryId", "name")
      .sort({ name: 1 })
      .lean(),
  ]);

  const bodegaIds = bodegaProducts
    .map((product) => idToString(product._id))
    .filter(Boolean)
    .map((id) => new Types.ObjectId(id));

  const standards = await StandardPackingModel.find({
    isActive: true,
    productId: { $in: bodegaIds },
  })
    .select("productId standardPacking")
    .lean();

  const packSizeByProductId = new Map<string, number>();

  for (const standard of standards) {
    const productId = idToString(standard.productId);
    const packSize = wholeNumber(standard.standardPacking);

    if (productId && packSize > 0 && !packSizeByProductId.has(productId)) {
      packSizeByProductId.set(productId, packSize);
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      customers: customers.map((customer) => ({
        _id: idToString(customer._id),
        name: customer.name || "",
        phone: customer.phone || "",
        address: customer.address || "",
        type: customer.type || "DELIVERY",
      })),
      outlets: outlets.map((outlet) => ({
        _id: idToString(outlet._id),
        name: outlet.name || "",
        code: outlet.code || "",
        address: outlet.address || "",
        managerName: outlet.managerName || "",
        contactNumber: outlet.contactNumber || "",
      })),
      bodegaProducts: bodegaProducts.map((product) => {
        const packSize = packSizeByProductId.get(idToString(product._id)) || 0;
        const stock = getPackBreakdown(product.stockQty, packSize);
        const sellingPrice = numberValue(product.sellingPrice);

        return {
          _id: idToString(product._id),
          name: product.name || "",
          categoryName: getCategoryName(product.categoryId),
          stockQty: numberValue(product.stockQty),
          stockPcs: stock.stockPcs,
          stockPacks: stock.stockPacks,
          stockLoosePcs: stock.stockLoosePcs,
          packSize,
          sellingPrice,
          pricePerPack: packSize > 0 ? sellingPrice : 0,
          pricePerPcs: packSize > 0 ? sellingPrice / packSize : 0,
        };
      }),
      products: groceryProducts.map((product) => ({
        _id: idToString(product._id),
        name: product.name || "",
        categoryName: getCategoryName(product.categoryId),
        stockPcs: numberValue(product.stockPcs),
        unitPrice: numberValue(product.unitPrice),
      })),
    },
  });
}
