exports.computeCommissionSplit = (totalAmount, sugRate, platformRate) => {
  const totalKobo = Math.round(Number(totalAmount) * 100);

  const sugKobo = Math.round(totalKobo * sugRate);
  const platformKobo = Math.round(totalKobo * platformRate);

  const commissionKobo = sugKobo + platformKobo;
  const vendorKobo = totalKobo - commissionKobo;

  return {
    totalAmount: totalKobo / 100,
    vendorAmount: vendorKobo / 100,
    sugAmount: sugKobo / 100,
    platformAmount: platformKobo / 100,
    commissionAmount: commissionKobo / 100,
    rates: { sugRate, platformRate, totalRate: sugRate + platformRate },
  };
};