import { describe, expect, it } from "vitest";
import { parseCidr, splitCidr } from "./cidr";

describe("cidr", () => {
  it("normalizes an IPv4 host address to its network", () => {
    const { info, error } = parseCidr("192.168.1.37/24");
    expect(error).toBeNull();
    expect(info?.network).toBe("192.168.1.0");
    expect(info?.broadcast).toBe("192.168.1.255");
    expect(info?.firstHost).toBe("192.168.1.1");
    expect(info?.lastHost).toBe("192.168.1.254");
    expect(info?.usableHostCount).toBe("254");
    expect(info?.totalHostCount).toBe("256");
    expect(info?.netmask).toBe("255.255.255.0");
    expect(info?.wildcard).toBe("0.0.0.255");
    expect(info?.ipClass).toBe("C");
    expect(info?.isPrivate).toBe(true);
  });

  it("handles /31 point-to-point links (2 addresses, both usable)", () => {
    const { info } = parseCidr("10.0.0.0/31");
    expect(info?.totalHostCount).toBe("2");
    expect(info?.usableHostCount).toBe("2");
    expect(info?.firstHost).toBe("10.0.0.0");
    expect(info?.lastHost).toBe("10.0.0.1");
  });

  it("handles /32 single-host prefix", () => {
    const { info } = parseCidr("8.8.8.8/32");
    expect(info?.network).toBe("8.8.8.8");
    expect(info?.broadcast).toBe("8.8.8.8");
    expect(info?.usableHostCount).toBe("1");
    expect(info?.ipClass).toBe("A");
    expect(info?.isPrivate).toBe(false);
  });

  it("treats a bare IPv4 as /32", () => {
    const { info } = parseCidr("1.2.3.4");
    expect(info?.prefix).toBe(32);
    expect(info?.network).toBe("1.2.3.4");
  });

  it("flags loopback, link-local, and multicast IPv4", () => {
    expect(parseCidr("127.0.0.1").info?.isLoopback).toBe(true);
    expect(parseCidr("169.254.1.1").info?.isLinkLocal).toBe(true);
    expect(parseCidr("224.0.0.1").info?.isMulticast).toBe(true);
  });

  it("rejects malformed IPv4", () => {
    expect(parseCidr("256.0.0.1").error).toBe("Invalid IPv4 address");
    expect(parseCidr("1.2.3").error).toBe("Invalid IPv4 address");
    expect(parseCidr("1.2.3.4/33").error).toMatch(/prefix/i);
  });

  it("parses IPv6 with :: compression", () => {
    const { info, error } = parseCidr("2001:db8::/32");
    expect(error).toBeNull();
    expect(info?.version).toBe(6);
    expect(info?.prefix).toBe(32);
    expect(info?.network).toBe("2001:db8::");
    expect(info?.totalHostCount).toBe((1n << 96n).toString());
  });

  it("parses IPv6 link-local and handles embedded IPv4", () => {
    expect(parseCidr("fe80::1").info?.isLinkLocal).toBe(true);
    expect(parseCidr("::ffff:192.0.2.1").info?.version).toBe(6);
  });

  it("normalizes IPv6 host bits within the prefix", () => {
    const { info } = parseCidr("2001:db8:abcd:0012:1234::/48");
    expect(info?.network).toBe("2001:db8:abcd::");
    expect(info?.rangeEnd).toMatch(/^2001:db8:abcd:ffff:ffff:ffff:ffff:ffff$/i);
  });

  it("rejects invalid IPv6", () => {
    expect(parseCidr("2001::db8::1").error).toBe("Invalid IPv6 address");
    expect(parseCidr("gggg::/16").error).toBe("Invalid IPv6 address");
    expect(parseCidr("::/129").error).toMatch(/prefix/i);
  });
});

describe("splitCidr (VLSM)", () => {
  it("splits a /16 into four equal /18s with no remainder", () => {
    const result = splitCidr("10.1.0.0/16", [
      { id: "a", name: "A", prefix: 18 },
      { id: "b", name: "B", prefix: 18 },
      { id: "c", name: "C", prefix: 18 },
      { id: "d", name: "D", prefix: 18 },
    ]);
    expect(result.error).toBeNull();
    expect(result.allocated).toHaveLength(4);
    expect(result.allocated.map((sub) => sub.cidr)).toEqual([
      "10.1.0.0/18",
      "10.1.64.0/18",
      "10.1.128.0/18",
      "10.1.192.0/18",
    ]);
    expect(result.remaining).toEqual([]);
  });

  it("packs variable-size subnets largest-first and reports free blocks", () => {
    const result = splitCidr("10.1.0.0/16", [
      { id: "app", name: "app", prefix: 20 },
      { id: "db", name: "db", prefix: 22 },
      { id: "hub", name: "hub", prefix: 18 },
      { id: "mgmt", name: "mgmt", prefix: 24 },
    ]);
    expect(result.error).toBeNull();
    expect(result.allocated.map((sub) => sub.cidr)).toEqual([
      "10.1.0.0/18",
      "10.1.64.0/20",
      "10.1.80.0/22",
      "10.1.84.0/24",
    ]);
    // Names survive sort into address order.
    expect(result.allocated.map((sub) => sub.name)).toEqual([
      "hub",
      "app",
      "db",
      "mgmt",
    ]);
    // Remaining space decomposed into valid CIDR blocks.
    const remainingCidrs = result.remaining.map((sub) => sub.cidr);
    expect(remainingCidrs.length).toBeGreaterThan(0);
    const remainingTotal = result.remaining.reduce(
      (acc, sub) => acc + BigInt(sub.hostCount),
      0n,
    );
    expect(remainingTotal).toBe(65536n - 16384n - 4096n - 1024n - 256n);
  });

  it("normalizes a parent with host bits", () => {
    const result = splitCidr("10.1.5.37/24", [
      { id: "a", name: "a", prefix: 26 },
    ]);
    expect(result.parentCidr).toBe("10.1.5.0/24");
    expect(result.allocated[0]?.cidr).toBe("10.1.5.0/26");
  });

  it("errors when a subnet does not fit", () => {
    const result = splitCidr("10.0.0.0/24", [
      { id: "a", name: "a", prefix: 25 },
      { id: "b", name: "b", prefix: 25 },
      { id: "c", name: "c", prefix: 25 },
    ]);
    expect(result.error).toMatch(/does not fit/i);
    expect(result.allocated).toHaveLength(2);
  });

  it("reports total demand from all requests, not just allocated ones", () => {
    // Three /25s in a /24 = 384 requested, 256 capacity. Capacity is the
    // important honesty signal so the user sees this as over-subscription,
    // not as a packing failure.
    const result = splitCidr("10.0.0.0/24", [
      { id: "a", name: "a", prefix: 25 },
      { id: "b", name: "b", prefix: 25 },
      { id: "c", name: "c", prefix: 25 },
    ]);
    expect(result.error).toMatch(/does not fit/i);
    expect(result.requestedTotal).toBe("384");
    expect(result.parentCapacity).toBe("256");
  });

  it("errors when a subnet is larger than the parent", () => {
    const result = splitCidr("10.0.0.0/24", [
      { id: "a", name: "a", prefix: 20 },
    ]);
    expect(result.error).toMatch(/larger than the parent/i);
  });

  it("does not drop alignment holes when remaining space is computed", () => {
    // Reviewer scenario: parent /24 with /26 then /25 in input order.
    // Largest-first sort places /25 at .0 and /26 at .128, leaving .192/26
    // as the only free block. Total accounting (192 allocated + 64 free
    // = 256) must always match parent capacity — proves no addresses are
    // silently dropped from the remaining-space report.
    const result = splitCidr("10.0.0.0/24", [
      { id: "first", name: "first", prefix: 26 },
      { id: "second", name: "second", prefix: 25 },
    ]);
    expect(result.error).toBeNull();
    expect(result.allocated.map((sub) => sub.cidr)).toEqual([
      "10.0.0.0/25",
      "10.0.0.128/26",
    ]);
    expect(result.remaining.map((sub) => sub.cidr)).toEqual(["10.0.0.192/26"]);
    const allocatedSum = result.allocated.reduce(
      (acc, sub) => acc + BigInt(sub.hostCount),
      0n,
    );
    const freeSum = result.remaining.reduce(
      (acc, sub) => acc + BigInt(sub.hostCount),
      0n,
    );
    expect(allocatedSum + freeSum).toBe(BigInt(result.parentCapacity));
  });

  it("accounts for every address in remaining + allocated for many shapes", () => {
    // Property check: across a variety of valid request mixes, the sum of
    // allocated host counts plus remaining host counts must always equal
    // the parent capacity. Guards against future regressions in the
    // free-fragment tracker (e.g. if largest-first sort is removed).
    const cases: Array<{ parent: string; prefixes: number[] }> = [
      { parent: "10.0.0.0/24", prefixes: [26, 25] },
      { parent: "10.0.0.0/24", prefixes: [27, 26, 25] },
      { parent: "10.0.0.0/22", prefixes: [24, 24, 26, 28] },
      { parent: "192.168.0.0/16", prefixes: [20, 22, 22, 24, 24, 24] },
    ];
    for (const { parent, prefixes } of cases) {
      const result = splitCidr(
        parent,
        prefixes.map((prefix, i) => ({
          id: `req-${i}`,
          name: `req-${i}`,
          prefix,
        })),
      );
      expect(result.error, `${parent} ${prefixes.join(",")}`).toBeNull();
      const allocatedSum = result.allocated.reduce(
        (acc, sub) => acc + BigInt(sub.hostCount),
        0n,
      );
      const freeSum = result.remaining.reduce(
        (acc, sub) => acc + BigInt(sub.hostCount),
        0n,
      );
      expect(
        allocatedSum + freeSum,
        `${parent} ${prefixes.join(",")} accounting`,
      ).toBe(BigInt(result.parentCapacity));
    }
  });

  it("splits IPv6 ranges", () => {
    const result = splitCidr("2001:db8::/48", [
      { id: "a", name: "a", prefix: 49 },
      { id: "b", name: "b", prefix: 49 },
    ]);
    expect(result.error).toBeNull();
    expect(result.allocated.map((sub) => sub.cidr)).toEqual([
      "2001:db8::/49",
      "2001:db8:0:8000::/49",
    ]);
  });
});
