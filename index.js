const fs = require("fs");
const phoneUtil = require("google-libphonenumber").PhoneNumberUtil.getInstance();
const phoneRegion = "BR";

/**
 * Verify if string is numeric
 * @param  {String} num The first number
 * @return {Boolean}    The result if string is numeric
 */
const isNumeric = (num) => {
  return !isNaN(num);
};

/**
 * Extract emails from string
 * @param  {String} text   Text to extract emails
 * @return {Array<String>} Extracted emails
 */
const extractEmails = (text) => {
  return text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi);
};

/**
 * Parse values, removing text inside quotes and between commas
 * @param  {String} str    Text to parse
 * @return {Array<String>} Parsed values
 */
const parseValue = (str) => {
  let text = str;
  if (str[0] === '"' && str[str.length - 1] === '"') {
    text = text.slice(1, -1);
  }
  text = text?.split(/[/,]/gi);
  return text.map((x) => x.trim());
};

fs.readFile("./input.csv", (err, data) => {
  if (err) {
    console.error(err);
    return;
  }
  const convertedData = data.toString();
  const rows = convertedData.split(/\r?\n/);
  const ignoredHeadersRows = rows.slice(1);
  const splitByCommaPattern = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/; // Ignore commas between quotes
  const columnNames = rows[0].split(splitByCommaPattern).map((x) => parseValue(x));
  const objs = [];

  ignoredHeadersRows.forEach((row) => {
    const columns = row.split(splitByCommaPattern);
    const idPosition = columnNames.findIndex((x) => x[0] === "eid");
    const foundUser = objs.find((x) => x.eid === columns[idPosition]);

    // Merge existing user data
    const data = foundUser ?? {
      groups: [],
      addresses: [],
    };

    columnNames.forEach((column, position) => {
      const allowedAddresses = ["email", "phone"];
      const booleanProperties = ["see_all", "invisible"];
      const current = parseValue(columns[position]);
      const columnName = column[0];
      const parsedColumnName = columnName.split(" ")[0]; // Remove property from tag values

      // Fill columns
      if (parsedColumnName === "group") {
        if (!current) return;
        current.forEach((x) => {
          if (!!x && !data.groups.includes(x)) {
            data.groups.push(x);
          }
        });
      } else if (allowedAddresses.includes(parsedColumnName)) {
        const tagValues = columnName.split(" ").slice(1) ?? [];
        const alreadyExists = data.addresses.findIndex((x) => x.type === parsedColumnName && x.address === current) !== -1;
        if (alreadyExists || !current) return;

        // Filtering and data parsing
        const parsedValue = current
          .filter((x) => {
            switch (parsedColumnName) {
              case "phone": {
                try {
                  const number = phoneUtil.parseAndKeepRawInput(x, phoneRegion);
                  return phoneUtil.isValidNumber(number);
                } catch {
                  return false;
                }
              }
              case "email": {
                const emails = extractEmails(x);
                return emails?.length > 0;
              }
              default:
                return false;
            }
          })
          .map((x) => {
            switch (parsedColumnName) {
              case "phone": {
                const number = phoneUtil.parseAndKeepRawInput(x, phoneRegion);
                return `${number.getCountryCode()}${number.getNationalNumber()}`;
              }
              case "email": {
                const emails = extractEmails(x);
                return emails[0];
              }
              default:
                return x;
            }
          });

        const parsedAddresses = parsedValue.map((x) => ({
          type: parsedColumnName,
          tags: tagValues,
          address: x,
        }));
        data.addresses.push(...parsedAddresses);
      } else if (booleanProperties.includes(parsedColumnName)) {
        const parseBoolean = (v) => {
          const booleanStrings = {
            yes: true,
            no: false,
          };

          if (isNumeric(v)) {
            return !!parseInt(v);
          }

          if (booleanStrings[v] !== undefined) {
            return booleanStrings[v];
          }

          return !!v;
        };

        data[parsedColumnName] = parseBoolean(current[0]);
      } else {
        data[parsedColumnName] = current[0];
      }
    });

    if (foundUser === undefined) {
      objs.push(data);
    }
  });

  fs.writeFile("./output.json", JSON.stringify(objs), () => {});
});
