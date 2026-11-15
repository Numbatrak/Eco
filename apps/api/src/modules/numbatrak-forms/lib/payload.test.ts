import { describe, expect, it } from "vitest";
import { detectFields, extractOfferId, flattenSubmission, parseUrlEncodedBody } from "./payload.js";

const OFFER = "3f2b9c1e-8d4a-4c7b-9e1f-0a2b3c4d5e6f";

describe("flattenSubmission", () => {
  it("flattens a Fluent Forms JSON body with nested name and address", () => {
    const flat = flattenSubmission({
      names: { first_name: "Ada", last_name: "Obi" },
      phone: "08012345678",
      address_1: { address_line_1: "12 Allen Ave", state: "Lagos" },
      input_radio: `off_${OFFER}`,
    });
    expect(flat).toEqual({
      "names.first_name": "Ada",
      "names.last_name": "Obi",
      phone: "08012345678",
      "address_1.address_line_1": "12 Allen Ave",
      "address_1.state": "Lagos",
      input_radio: `off_${OFFER}`,
    });
  });

  it("unwraps Elementor's fields.<id>.{title,value} to the field titles", () => {
    const flat = flattenSubmission({
      fields: {
        name: { id: "name", title: "Full Name", value: "Ada Obi" },
        field_9a: { id: "field_9a", title: "Package", value: `off_${OFFER}` },
      },
      form: { id: "abc", name: "Order" },
    });
    expect(flat["Full Name"]).toBe("Ada Obi");
    expect(flat["fields.name"]).toBe("Ada Obi");
    expect(flat.Package).toBe(`off_${OFFER}`);
    expect(flat["form.name"]).toBe("Order");
  });

  it("joins checkbox arrays and drops empty values", () => {
    expect(flattenSubmission({ extras: ["Mop", "Bucket"], blank: "  ", none: null })).toEqual({
      extras: "Mop, Bucket",
    });
  });
});

describe("parseUrlEncodedBody", () => {
  it("rebuilds bracketed keys into nested objects", () => {
    const body = parseUrlEncodedBody(
      "fields%5Bname%5D%5Btitle%5D=Name&fields%5Bname%5D%5Bvalue%5D=Ada&phone=0801&extra=a&extra=b",
    );
    expect(body).toEqual({ fields: { name: { title: "Name", value: "Ada" } }, phone: "0801", extra: "a, b" });
  });
});

describe("detectFields", () => {
  it("matches usual names ignoring case, spaces, dashes and underscores", () => {
    const found = detectFields({
      "Full Name": "Ada Obi",
      "Phone-Number": "0801",
      "WhatsApp Number": "0802",
      "Delivery Address": "12 Allen Ave",
      Region: "Lagos",
      Package: "Buy 2",
      Message: "Call after 5",
      tl: "abc123",
    });
    expect(found).toEqual({
      name: "Ada Obi",
      phone: "0801",
      whatsapp: "0802",
      address: "12 Allen Ave",
      state: "Lagos",
      package: "Buy 2",
      notes: "Call after 5",
      trackingLinkCode: "abc123",
    });
  });

  it("matches on the last part of a nested key, first match winning", () => {
    const found = detectFields({
      "names.first_name": "Ada",
      "names.last_name": "Obi",
      "address_1.state": "Lagos",
      "billing.state": "Abuja",
    });
    expect(found).toEqual({ firstName: "Ada", lastName: "Obi", state: "Lagos" });
  });
});

describe("extractOfferId", () => {
  it("finds the offer id in a prefixed or labelled value", () => {
    expect(extractOfferId(`off_${OFFER}`)).toBe(OFFER);
    expect(extractOfferId(`Buy 2 Get 2 Free | off_${OFFER.toUpperCase()}`)).toBe(OFFER);
    expect(extractOfferId("Buy 2 Get 2 Free")).toBeNull();
    expect(extractOfferId(null)).toBeNull();
  });
});
