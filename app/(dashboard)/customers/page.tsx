// app/(dashboard)/customers/page.tsx
import { MasterDataPage } from "@/components/master-data/MasterDataPage";

export default function CustomersPage() {
  return (
    <MasterDataPage
      title="Customers"
      cardTitle="All Customer Info"
      apiPath="/api/customers"
      resourceName="Customer"
      searchPlaceholder="Search customer name..."
      columns={[
        {
          key: "name",
          label: "Name",
        },
        {
          key: "email",
          label: "Email",
        },
        {
          key: "phone",
          label: "Phone",
        },
        {
          key: "address",
          label: "Address",
        },
        {
          key: "type",
          label: "Type",
        },
      ]}
      fields={[
        {
          name: "name",
          label: "Name",
          placeholder: "Enter customer name",
          required: true,
        },
        {
          name: "email",
          label: "Email",
          placeholder: "Enter email address",
          inputType: "email",
        },
        {
          name: "phone",
          label: "Phone",
          placeholder: "Enter phone number",
          inputType: "tel",
        },
        {
          name: "address",
          label: "Address",
          placeholder: "Enter address",
          inputType: "textarea",
        },
        {
          name: "type",
          label: "Type",
          inputType: "select",
          defaultValue: "SALE",
          options: [
            {
              label: "Sale",
              value: "SALE",
            },
            {
              label: "Delivery",
              value: "DELIVERY",
            },
            {
              label: "Both",
              value: "BOTH",
            },
          ],
        },
      ]}
    />
  );
}