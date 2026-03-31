<template>
  <h1>Data</h1>
  <p>This page would display a data table for the simulation output.</p>
  <table class="demo-table">
    <thead>
      <tr>
        <th>Day</th>
        <th>Susceptible</th>
        <th>Infected</th>
        <th>Recovered</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1</td>
        <td>495</td>
        <td>5</td>
        <td>0</td>
      </tr>
      <tr>
        <td>2</td>
        <td>488</td>
        <td>9</td>
        <td>3</td>
      </tr>
      <tr>
        <td>3</td>
        <td>476</td>
        <td>15</td>
        <td>9</td>
      </tr>
      <tr>
        <td>4</td>
        <td>458</td>
        <td>24</td>
        <td>18</td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.demo-table {
  width: 100%;
  margin-top: var(--space-4);
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}

.demo-table th,
.demo-table td {
  padding: var(--space-2) var(--space-3);
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

.demo-table th {
  font-weight: 600;
  color: var(--color-text-secondary);
}
</style>
