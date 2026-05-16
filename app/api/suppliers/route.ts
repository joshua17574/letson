// app/api/suppliers/route.ts
import { NextRequest, NextResponse } from "next/server";
import type { QueryFilter } from "mongoose";

import dbConnect from "@/lib/mongodb";
import { requireApiAuth } from "@/lib/require-auth";
import {
  cleanString,
  escapeRegex,
  getPagination,
  serializeDocuments,
  serializeDocument,
} from "@/lib/crud-utils";
import SupplierModel, { ISupplier } from "@/models/Supplier";

export async function GET(req: NextRequest) {
  const { response } = await requireApiAuth();

  if (response) return response;

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = getPagination(searchParams);

  const search = cleanString(searchParams.get("search"));

  const filter: QueryFilter<ISupplier> = {
    isActive: true,
  };

  if (search) {
    filter.name = {
      $regex: escapeRegex(search),
      $options: "i",
    };
  }

  const [items, total] = await Promise.all([
    SupplierModel.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    SupplierModel.countDocuments(filter),
  ]);

  return NextResponse.json({
    success: true,
    data: serializeDocuments(items),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  });
}

export async function POST(req: NextRequest) {
  const { response } = await requireApiAuth();

  if (response) return response;

  await dbConnect();

  const body = await req.json();

  const name = cleanString(body.name);
  const email = cleanString(body.email);
  const phone = cleanString(body.phone);
  const address = cleanString(body.address);

  if (!name) {
    return NextResponse.json(
      {
        success: false,
        message: "Supplier name is required.",
      },
      { status: 400 }
    );
  }

  const supplier = await SupplierModel.create({
    name,
    email,
    phone,
    address,
  });

  return NextResponse.json(
    {
      success: true,
      message: "Supplier created successfully.",
      data: serializeDocument(supplier.toObject()),
    },
    { status: 201 }
  );
}